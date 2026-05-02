import { ulid } from 'ulid';
import type {
  CosmicSnapshot,
  GenerateReq,
  GenerateRes,
  MusicalPicks,
  PhraseOfTheMoment,
  StateVector,
  Sticker,
} from '@hero-syndrome/shared';
import {
  composeSong,
  AnthropicError,
  buildClaudePromptJson,
  renderCompositionWithRetry,
  ElevenLabsError,
  ruleTableComposition,
  type ComposeSongResult,
} from '@hero-syndrome/llm';
import { composeDirectorialBlock, makePicks } from '@hero-syndrome/musical-schema';
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
  stickers: Sticker[];
  quantumBytes: { bytes: number[]; source: 'qrng' | 'mixed' | 'pseudo' };
  phraseOfTheMoment?: PhraseOfTheMoment;
  musicalPicks?: MusicalPicks;
}

export async function runGenerate(
  ctx: GenerateContext,
  req: GenerateReq,
): Promise<GenerateResult> {
  // 32 bytes per song: bytes 0..4 → phraseOfTheMoment, bytes 5..22 → musical
  // schema picks (max 18), bytes 23..31 → reserved headroom.
  const quantum = await pullQuantumBytes(ctx.env, 32);

  let composeResult: ComposeSongResult | null = null;
  let composition: ComposeSongResult['composition'];
  let metadata: ComposeSongResult['metadata'];
  let llmLatencyMs: number | undefined;
  let llmTokens: { input: number; output: number } | undefined;

  const phraseOfTheMoment = ctx.cosmic?.spaceWeather
    ? derivePhraseOfTheMoment({
        spaceWeather: ctx.cosmic.spaceWeather,
        quantumBytes: quantum.bytes.slice(0, 5),
      })
    : null;

  const promptJson = buildClaudePromptJson({
    stateVector: req.stateVector,
    stickers: req.stickers,
    vibes: {
      ...(ctx.cosmic?.cosmicWord?.word ? { wordOfTheMoment: ctx.cosmic.cosmicWord.word } : {}),
      ...(phraseOfTheMoment ? { phraseOfTheMoment: phraseOfTheMoment.phrase } : {}),
    },
    recentHistory: req.recentHistory,
  });

  const musicalPicks = makePicks({ state: promptJson.state, bytes: quantum.bytes.slice(5) });
  const directorialBlock = composeDirectorialBlock(musicalPicks);

  try {
    composeResult = await composeSong({
      apiKey: ctx.env.ANTHROPIC_API_KEY,
      promptJson,
      directorialBlock,
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
      stickers: req.stickers,
      recentIntent: ctx.recentTransitionIntent,
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
    if (err instanceof ElevenLabsError) {
      // Surface as 503 to the client so it can fall back to a prelude.
      throw err;
    }
    throw err;
  }

  // Bake the per-song cosmic snapshot into the song's stateVector so the
  // episode page can render which cosmic word landed for which song.
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
    stickers: req.stickers,
    quantumBytes: quantum,
    musicalPicks,
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
  if (llmTokens) result.llmTokens = llmTokens;
  return result;
}
