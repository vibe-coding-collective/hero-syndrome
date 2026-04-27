import poolData from '@hero-syndrome/cosmic-vocab/approved-pool.json';
import embeddingsData from '@hero-syndrome/cosmic-vocab/approved-pool-embeddings.json';
import projectionData from '@hero-syndrome/cosmic-vocab/projection.json';
import fluxStatsData from '@hero-syndrome/cosmic-vocab/flux-stats.json';
import {
  decodeQuantizedEmbeddings,
  isStubPool,
  type ApprovedPool,
  type ApprovedPoolEmbeddings,
  type FluxStats,
  type ProjectionMatrix,
} from '@hero-syndrome/cosmic-vocab';
import type { Env } from '../types';

const POOL = poolData as ApprovedPool;
const EMBEDDINGS_RAW = embeddingsData as ApprovedPoolEmbeddings;
const PROJECTION = projectionData as ProjectionMatrix;
const FLUX_STATS = fluxStatsData as FluxStats;

const EMBEDDINGS_DECODED = decodeQuantizedEmbeddings(EMBEDDINGS_RAW);

export interface DailyVocab {
  date: string;
  indices: number[];
  vocabSeed: string;
  generatedAtUtc: string;
  poolVersion: string;
  projectionVersion: string;
}

export interface CosmicWordResult {
  word: string;
  flux: number[];
  method: 'random-projection-bge-small';
  source: 'goes-proton-differential' | 'pseudo';
  fetchedAtUtc: string;
  vocabDate: string;
  vocabSeed: string;
}

function isVocabReady(): boolean {
  return (
    !isStubPool(POOL) &&
    !isStubPool(EMBEDDINGS_RAW) &&
    !isStubPool(PROJECTION) &&
    !isStubPool(FLUX_STATS) &&
    POOL.words.length > 0 &&
    EMBEDDINGS_DECODED.count === POOL.words.length &&
    PROJECTION.values.length === PROJECTION.rows * PROJECTION.cols &&
    FLUX_STATS.channelMeans.length === PROJECTION.rows
  );
}

export function vocabReady(): boolean {
  return isVocabReady();
}

export function utcDateString(d: Date = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function utcYesterdayString(d: Date = new Date()): string {
  const y = new Date(d.getTime() - 86_400_000);
  return utcDateString(y);
}

export async function getDailyVocab(env: Env, date: string): Promise<DailyVocab | null> {
  return env.EPISODES.get<DailyVocab>(`cosmic-vocab:${date}`, 'json');
}

export async function loadActiveVocab(env: Env): Promise<DailyVocab | null> {
  const today = utcDateString();
  const yesterday = utcYesterdayString();
  return (await getDailyVocab(env, today)) ?? (await getDailyVocab(env, yesterday));
}

function standardizeFlux(rawFlux: number[]): number[] {
  return rawFlux.map((v, i) => {
    const log = Math.log10(Math.max(v, 0) + 1e-6);
    const mean = FLUX_STATS.channelMeans[i] ?? 0;
    const sd = FLUX_STATS.channelStddevs[i] ?? 1;
    return (log - mean) / (sd === 0 ? 1 : sd);
  });
}

function project(stdFlux: number[]): Float32Array {
  const out = new Float32Array(PROJECTION.cols);
  for (let r = 0; r < PROJECTION.rows; r++) {
    const x = stdFlux[r] ?? 0;
    if (x === 0) continue;
    const rowOffset = r * PROJECTION.cols;
    for (let c = 0; c < PROJECTION.cols; c++) {
      out[c]! += x * PROJECTION.values[rowOffset + c]!;
    }
  }
  let mag = 0;
  for (let c = 0; c < out.length; c++) mag += out[c]! * out[c]!;
  mag = Math.sqrt(mag) || 1;
  for (let c = 0; c < out.length; c++) out[c]! /= mag;
  return out;
}

function topMatch(query: Float32Array, indices: number[]): number {
  const dim = EMBEDDINGS_DECODED.dim;
  const values = EMBEDDINGS_DECODED.values;
  let bestI = indices[0]!;
  let bestSim = -Infinity;
  for (const idx of indices) {
    const off = idx * dim;
    let sim = 0;
    for (let c = 0; c < dim; c++) sim += query[c]! * values[off + c]!;
    if (sim > bestSim) {
      bestSim = sim;
      bestI = idx;
    }
  }
  return bestI;
}

export async function deriveCosmicWord(
  env: Env,
  flux: number[],
  fetchedAtUtc: string,
): Promise<CosmicWordResult | null> {
  if (!isVocabReady()) return null;
  if (flux.length !== PROJECTION.rows) return null;

  const vocab = await loadActiveVocab(env);
  if (!vocab) return null;

  const stdFlux = standardizeFlux(flux);
  const query = project(stdFlux);
  const idx = topMatch(query, vocab.indices);
  const word = POOL.words[idx];
  if (!word) return null;

  return {
    word,
    flux,
    method: 'random-projection-bge-small',
    source: 'goes-proton-differential',
    fetchedAtUtc,
    vocabDate: vocab.date,
    vocabSeed: vocab.vocabSeed,
  };
}

export const COSMIC_VOCAB_META = {
  poolVersion: POOL.version,
  projectionVersion: PROJECTION.version,
  embeddingsVersion: EMBEDDINGS_RAW.version,
  fluxStatsVersion: FLUX_STATS.version,
  poolSize: POOL.words.length,
  projectionDim: PROJECTION.cols,
  channels: PROJECTION.rows,
  embeddingsCount: EMBEDDINGS_DECODED.count,
};
