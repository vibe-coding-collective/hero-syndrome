import materialPoolData from '@hero-syndrome/material-force-vocab/material-pool.json';
import materialEmbeddingsData from '@hero-syndrome/material-force-vocab/material-pool-embeddings.json';
import forcePoolData from '@hero-syndrome/material-force-vocab/force-pool.json';
import forceEmbeddingsData from '@hero-syndrome/material-force-vocab/force-pool-embeddings.json';
import projectionData from '@hero-syndrome/material-force-vocab/projection.json';
import spaceWeatherStatsData from '@hero-syndrome/material-force-vocab/spaceweather-stats.json';
import {
  decodeQuantizedEmbeddings,
  isStubPool,
  type ProjectionMatrix3D,
  type SpaceWeatherStats,
  type VocabPool,
  type VocabPoolEmbeddings,
} from '@hero-syndrome/material-force-vocab';
import type { PhraseOfTheMoment } from '@hero-syndrome/shared';

const MATERIAL_POOL = materialPoolData as VocabPool;
const FORCE_POOL = forcePoolData as VocabPool;
const MATERIAL_EMB_RAW = materialEmbeddingsData as VocabPoolEmbeddings;
const FORCE_EMB_RAW = forceEmbeddingsData as VocabPoolEmbeddings;
const PROJECTION = projectionData as ProjectionMatrix3D;
const STATS = spaceWeatherStatsData as SpaceWeatherStats;

const MATERIAL_EMB = decodeQuantizedEmbeddings(MATERIAL_EMB_RAW);
const FORCE_EMB = decodeQuantizedEmbeddings(FORCE_EMB_RAW);

/** Cosine sims between a random projection and word embeddings sit in a
 *  narrow range (~[-0.3, +0.3]); a small temperature gives the top words
 *  meaningful prevalence in the softmax. Tunable. */
const SOFTMAX_TEMPERATURE = 0.03;

interface SpaceWeather {
  kIndex: number;
  solarWindSpeedKmS: number;
  solarWindDensity: number;
}

function isReady(): boolean {
  return (
    !isStubPool(MATERIAL_POOL) &&
    !isStubPool(FORCE_POOL) &&
    !isStubPool(MATERIAL_EMB_RAW) &&
    !isStubPool(FORCE_EMB_RAW) &&
    !isStubPool(PROJECTION) &&
    !isStubPool(STATS) &&
    MATERIAL_POOL.words.length > 0 &&
    FORCE_POOL.words.length > 0 &&
    MATERIAL_EMB.count === MATERIAL_POOL.words.length &&
    FORCE_EMB.count === FORCE_POOL.words.length &&
    PROJECTION.values.length === PROJECTION.rows * PROJECTION.cols &&
    PROJECTION.cols === MATERIAL_EMB.dim &&
    PROJECTION.cols === FORCE_EMB.dim
  );
}

export function phraseVocabReady(): boolean {
  return isReady();
}

function standardize(sw: SpaceWeather): [number, number, number] {
  const kZ = (sw.kIndex - STATS.kIndexMean) / (STATS.kIndexStddev || 1);
  const speedZ = (sw.solarWindSpeedKmS - STATS.solarWindSpeedMean) / (STATS.solarWindSpeedStddev || 1);
  const densityZ = (sw.solarWindDensity - STATS.solarWindDensityMean) / (STATS.solarWindDensityStddev || 1);
  return [kZ, speedZ, densityZ];
}

function project(z: [number, number, number]): Float32Array {
  const out = new Float32Array(PROJECTION.cols);
  for (let r = 0; r < 3; r++) {
    const x = z[r] ?? 0;
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

function similarityWeightedSample(
  query: Float32Array,
  emb: { count: number; dim: number; values: Float32Array },
  uniformRandom: number,
): number {
  const sims = new Float32Array(emb.count);
  for (let i = 0; i < emb.count; i++) {
    const off = i * emb.dim;
    let s = 0;
    for (let c = 0; c < emb.dim; c++) s += query[c]! * emb.values[off + c]!;
    sims[i] = s;
  }
  let max = -Infinity;
  for (let i = 0; i < emb.count; i++) if (sims[i]! > max) max = sims[i]!;
  let sumExp = 0;
  const exps = new Float32Array(emb.count);
  for (let i = 0; i < emb.count; i++) {
    const e = Math.exp((sims[i]! - max) / SOFTMAX_TEMPERATURE);
    exps[i] = e;
    sumExp += e;
  }
  const target = uniformRandom * sumExp;
  let cum = 0;
  for (let i = 0; i < emb.count; i++) {
    cum += exps[i]!;
    if (cum >= target) return i;
  }
  return emb.count - 1;
}

function bytesToUniform(b1: number, b2: number): number {
  return ((b1 << 8) | b2) / 65536;
}

export interface DerivePhraseInput {
  spaceWeather: SpaceWeather;
  /** Per-song quantum bytes. The first 5 are consumed:
   *  bytes[0..1] → material sample, bytes[2..3] → force sample,
   *  bytes[4] → word-order coin toss. */
  quantumBytes: number[];
}

export function derivePhraseOfTheMoment(input: DerivePhraseInput): PhraseOfTheMoment | null {
  if (!isReady()) return null;
  if (input.quantumBytes.length < 5) return null;

  const z = standardize(input.spaceWeather);
  const query = project(z);

  const matU = bytesToUniform(input.quantumBytes[0]!, input.quantumBytes[1]!);
  const forceU = bytesToUniform(input.quantumBytes[2]!, input.quantumBytes[3]!);
  const orderByte = input.quantumBytes[4]!;

  const matIdx = similarityWeightedSample(query, MATERIAL_EMB, matU);
  const forceIdx = similarityWeightedSample(query, FORCE_EMB, forceU);

  const material = MATERIAL_POOL.words[matIdx]!;
  const force = FORCE_POOL.words[forceIdx]!;

  const wordOrder: 'force-material' | 'material-force' =
    orderByte < 128 ? 'force-material' : 'material-force';
  const phrase = wordOrder === 'force-material' ? `${force} ${material}` : `${material} ${force}`;

  return {
    phrase,
    material,
    force,
    wordOrder,
    pools: {
      materialVersion: MATERIAL_POOL.version,
      forceVersion: FORCE_POOL.version,
    },
  };
}

export const PHRASE_VOCAB_META = {
  materialPoolVersion: MATERIAL_POOL.version,
  forcePoolVersion: FORCE_POOL.version,
  materialPoolSize: MATERIAL_POOL.words.length,
  forcePoolSize: FORCE_POOL.words.length,
  projectionVersion: PROJECTION.version,
  spaceweatherStatsVersion: STATS.version,
  embeddingDim: PROJECTION.cols,
  softmaxTemperature: SOFTMAX_TEMPERATURE,
};
