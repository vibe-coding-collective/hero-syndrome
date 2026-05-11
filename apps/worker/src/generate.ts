import { ulid } from 'ulid';
import type {
  BodyActivity,
  CosmicSnapshot,
  GenerateReq,
  GenerateRes,
  LocationType,
  PhraseOfTheMoment,
  RenderPlan,
  StackedMeta,
  StateVector,
} from '@hero-syndrome/shared';
import {
  composeSong,
  classifyLocation,
  AnthropicError,
  buildClaudePromptJson,
  renderCompositionWithRetry,
  ElevenLabsError,
  ruleTableComposition,
  type ComposeSongResult,
} from '@hero-syndrome/llm';
import {
  buildLexiconContext,
  metaToPlan,
  moonPhaseForDate,
} from '@hero-syndrome/musical-schema';
import type { Env } from './types';
import { pullQuantumBytes } from './quantumDO';
import { sessionSongKey } from './r2';
import { derivePhraseOfTheMoment } from './cosmic/phraseOfTheMoment';

export interface GenerateContext {
  env: Env;
  sessionId: string;
  cosmic?: CosmicSnapshot;
  recentTransitionIntent?: ComposeSongResult['metadata']['transitionIntent'];
}

export interface GenerateResult {
  response: GenerateRes;
  songRecord: SongRecordPersist;
  llmLatencyMs?: number;
  classifyLocationLatencyMs?: number;
  musicLatencyMs: number;
  llmTokens?: { input: number; output: number };
  preludeFallback: boolean;
}

export interface SongRecordPersist {
  songId: string;
  startedAt: string;
  durationSec: number;
  metadata: ComposeSongResult['metadata'];
  composition: ComposeSongResult['composition'];
  stateVector: StateVector;
  quantumBytes: { bytes: number[]; source: 'qrng' | 'mixed' | 'pseudo' };
  phraseOfTheMoment?: PhraseOfTheMoment;
  stacked?: StackedMeta;
  renderPlan?: RenderPlan;
  locationType?: LocationType;
  bodyActivity?: BodyActivity;
}

/** Pick top-K mood tags above a weight threshold. */
function topMoodTags(mood: Record<string, number>, k = 6, threshold = 0.1): string[] {
  return Object.entries(mood)
    .filter(([, w]) => w >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([tag]) => tag);
}

export async function runGenerate(
  ctx: GenerateContext,
  req: GenerateReq,
): Promise<GenerateResult> {
  // 32 bytes per song: bytes 0..4 → phraseOfTheMoment, bytes 5..22 → seed
  // for stacked-meta stochasticity if we ever need it, 23..31 → headroom.
  const quantum = await pullQuantumBytes(ctx.env, 32);

  const phraseOfTheMoment = ctx.cosmic?.spaceWeather
    ? derivePhraseOfTheMoment({
        spaceWeather: ctx.cosmic.spaceWeather,
        quantumBytes: quantum.bytes.slice(0, 5),
      })
    : null;

  // Classify location (1-of-50) if we have reverse-geocode hints. Falls back
  // to 'unknown' on classification failure or missing inputs.
  let locationType: LocationType = 'unknown';
  let classifyLocationLatencyMs: number | undefined;
  if (req.stateVector.location?.place || req.stateVector.location?.road || req.stateVector.location?.city) {
    try {
      const cls = await classifyLocation({
        apiKey: ctx.env.ANTHROPIC_API_KEY,
        geocode: {
          ...(req.stateVector.location.place ? { place: req.stateVector.location.place } : {}),
          ...(req.stateVector.location.road ? { road: req.stateVector.location.road } : {}),
          ...(req.stateVector.location.neighborhood
            ? { neighborhood: req.stateVector.location.neighborhood }
            : {}),
          ...(req.stateVector.location.city ? { city: req.stateVector.location.city } : {}),
          ...(req.stateVector.location.state ? { state: req.stateVector.location.state } : {}),
          ...(req.stateVector.location.country ? { country: req.stateVector.location.country } : {}),
        },
        ...(req.stateVector.location.nearby ? { nearby: req.stateVector.location.nearby } : {}),
      });
      locationType = cls.locationType;
      classifyLocationLatencyMs = cls.latencyMs;
    } catch (err) {
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        sessionId: ctx.sessionId,
        event: 'classifyLocation.error',
        reason: String(err),
      }));
    }
  }

  // Run the musical-schema pipeline.
  const moonPhase = moonPhaseForDate(new Date());
  const bodyActivity: BodyActivity =
    req.stateVector.location?.bodyActivity ?? 'still';
  const seed = `${ctx.sessionId}:${quantum.bytes.slice(0, 8).join('-')}`;
  const { stacked, renderPlan } = metaToPlan(
    {
      timePhase: req.stateVector.time.phase,
      dayOfWeek: req.stateVector.time.dayOfWeek,
      weatherCondition: req.stateVector.weather?.condition ?? 'mainly_clear',
      moonPhase,
      bodyActivity,
      ...(locationType !== 'unknown' ? { locationType } : {}),
    },
    { seed },
  );

  // Build compact lexicon vocabulary for Claude.
  const activeMoods = topMoodTags(stacked.mood, 6, 0.1);
  const worldIds: string[] = [stacked.inspiration.world];
  if (stacked.inspiration.worldSecondary) worldIds.push(stacked.inspiration.worldSecondary);
  const lexicon = buildLexiconContext({
    timePhase: stacked.timePhase,
    weatherCondition: stacked.weatherCondition,
    moonPhase: stacked.moonPhase,
    dayOfWeek: req.stateVector.time.dayOfWeek,
    bodyActivity,
    ...(locationType !== 'unknown' ? { locationType } : {}),
    activeMoodTags: activeMoods,
    textureKeys: stacked.inspiration.textureKeys,
    worldIds,
  });

  const promptJson = buildClaudePromptJson({
    stateVector: req.stateVector,
    moonPhase,
    stacked,
    renderPlan,
    lexicon,
    ...(locationType !== 'unknown' ? { locationType } : {}),
    vibes: phraseOfTheMoment ? { phraseOfTheMoment: phraseOfTheMoment.phrase } : {},
    recentHistory: req.recentHistory,
  });

  let composeResult: ComposeSongResult | null = null;
  let composition: ComposeSongResult['composition'];
  let metadata: ComposeSongResult['metadata'];
  let llmLatencyMs: number | undefined;
  let llmTokens: { input: number; output: number } | undefined;

  try {
    composeResult = await composeSong({
      apiKey: ctx.env.ANTHROPIC_API_KEY,
      promptJson,
    });
    metadata = composeResult.metadata;
    composition = composeResult.composition;
    llmLatencyMs = composeResult.latencyMs;
    llmTokens = { input: composeResult.usage.input_tokens, output: composeResult.usage.output_tokens };
  } catch (err) {
    if (!(err instanceof AnthropicError)) throw err;
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      sessionId: ctx.sessionId,
      event: 'compose.fallback',
      reason: err.message,
      status: err.status,
    }));
    const fb = ruleTableComposition({
      stateVector: req.stateVector,
      ...(ctx.recentTransitionIntent ? { recentIntent: ctx.recentTransitionIntent } : {}),
    });
    metadata = fb.metadata;
    composition = fb.composition;
  }

  const songId = ulid();
  const startedAt = new Date().toISOString();

  let durationSec = composition.sections.reduce((acc, s) => acc + s.durationSec, 0);
  let musicLatencyMs = 0;

  const start = Date.now();
  try {
    const rendered = await renderCompositionWithRetry({
      apiKey: ctx.env.ELEVENLABS_API_KEY,
      composition,
    });
    musicLatencyMs = Date.now() - start;
    durationSec = rendered.durationSec;

    await ctx.env.AUDIO.put(sessionSongKey(ctx.sessionId, songId), rendered.audio, {
      httpMetadata: { contentType: rendered.contentType },
    });
  } catch (err) {
    musicLatencyMs = Date.now() - start;
    if (err instanceof ElevenLabsError) throw err;
    throw err;
  }

  const stateVectorForRecord: typeof req.stateVector = ctx.cosmic
    ? { ...req.stateVector, cosmic: ctx.cosmic }
    : req.stateVector;

  const songRecord: SongRecordPersist = {
    songId,
    startedAt,
    durationSec,
    metadata,
    composition,
    stateVector: stateVectorForRecord,
    quantumBytes: quantum,
    stacked,
    renderPlan,
    locationType,
    bodyActivity,
    ...(phraseOfTheMoment ? { phraseOfTheMoment } : {}),
  };

  const response: GenerateRes = {
    songId,
    songUrl: `/api/song/${ctx.sessionId}/${songId}`,
    metadata,
    composition,
    durationSec,
  };

  const result: GenerateResult = {
    response,
    songRecord,
    musicLatencyMs,
    preludeFallback: false,
  };
  if (typeof llmLatencyMs === 'number') result.llmLatencyMs = llmLatencyMs;
  if (typeof classifyLocationLatencyMs === 'number') result.classifyLocationLatencyMs = classifyLocationLatencyMs;
  if (llmTokens) result.llmTokens = llmTokens;
  return result;
}
