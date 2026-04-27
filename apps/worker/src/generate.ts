import { ulid } from 'ulid';
import type {
  CosmicSnapshot,
  GenerateReq,
  GenerateRes,
  StateVector,
  Sticker,
} from '@hero-syndrome/shared';
import {
  composeSong,
  AnthropicError,
  renderCompositionWithRetry,
  ElevenLabsError,
  ruleTableComposition,
  type ComposeSongResult,
} from '@hero-syndrome/llm';
import type { Env } from './types';
import { pullQuantumBytes } from './quantumDO';
import { sessionSongKey } from './r2';

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
}

export async function runGenerate(
  ctx: GenerateContext,
  req: GenerateReq,
): Promise<GenerateResult> {
  const quantum = await pullQuantumBytes(ctx.env, 16);

  let composeResult: ComposeSongResult | null = null;
  let composition: ComposeSongResult['composition'];
  let metadata: ComposeSongResult['metadata'];
  let llmLatencyMs: number | undefined;
  let llmTokens: { input: number; output: number } | undefined;

  try {
    composeResult = await composeSong({
      apiKey: ctx.env.ANTHROPIC_API_KEY,
      stateVector: req.stateVector,
      stickers: req.stickers,
      cosmic: ctx.cosmic,
      quantumBytes: quantum,
      recentHistory: req.recentHistory,
    });
    metadata = composeResult.metadata;
    composition = composeResult.composition;
    llmLatencyMs = composeResult.latencyMs;
    llmTokens = { input: composeResult.usage.input_tokens, output: composeResult.usage.output_tokens };
  } catch (err) {
    if (!(err instanceof AnthropicError)) throw err;
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

    await ctx.env.AUDIO.put(sessionSongKey(ctx.sessionId, songId), rendered.body, {
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

  const songRecord: SongRecordPersist = {
    songId,
    startedAt,
    durationSec,
    metadata,
    composition,
    stateVector: req.stateVector,
    stickers: req.stickers,
    quantumBytes: quantum,
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
