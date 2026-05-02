export interface VocabPool {
  version: string;
  words: string[];
  /** Per-word source attribution. Same length as `words`. Each entry is the
   *  short source key (e.g. "rruff", "color-of-art", "beeton-1861"). The
   *  full source list lives in docs/data-sources.md. */
  sources?: string[];
}

export interface VocabPoolEmbeddings {
  version: string;
  dim: number;
  count?: number;
  quantized: boolean;
  encoding?: 'int8-base64';
  scale?: number;
  /** Base64 of an Int8Array `count * dim` long, when quantized=true */
  data?: string;
  /** Legacy float arrays, when quantized=false */
  embeddings?: number[][];
}

export interface ProjectionMatrix3D {
  version: string;
  /** Always 3 — the dimensions of [kIndex_z, solarWindSpeed_z, solarWindDensity_z]. */
  rows: 3;
  /** Embedding dim, e.g. 384 for bge-small. */
  cols: number;
  /** Row-major, length = rows * cols. */
  values: number[];
}

export interface SpaceWeatherStats {
  version: string;
  /** Mean and stddev of K-index over the calibration window. */
  kIndexMean: number;
  kIndexStddev: number;
  /** Mean and stddev of solar wind speed (km/s). */
  solarWindSpeedMean: number;
  solarWindSpeedStddev: number;
  /** Mean and stddev of solar wind density (particles/cm³). */
  solarWindDensityMean: number;
  solarWindDensityStddev: number;
  /** ISO date range used to compute these stats. */
  calibrationFromUtc?: string;
  calibrationToUtc?: string;
}

export const STUB_VERSION = 'stub';

export function isStubPool(pool: { version: string }): boolean {
  return pool.version === STUB_VERSION;
}

/**
 * Decode quantized int8 base64 embeddings into a contiguous Float32Array
 * of `count * dim` elements. Each float is recovered as `byte / scale`.
 * The output is L2-renormalized per row (the source embeddings were
 * normalized before quantization, but quantization introduces small
 * denormalization that cosine similarity is sensitive to).
 */
export function decodeQuantizedEmbeddings(emb: VocabPoolEmbeddings): {
  count: number;
  dim: number;
  values: Float32Array;
} {
  if (!emb.quantized || !emb.data) {
    return { count: 0, dim: emb.dim, values: new Float32Array(0) };
  }
  const scale = emb.scale ?? 127;
  const dim = emb.dim;
  const bin = base64ToBytes(emb.data);
  const count = emb.count ?? Math.floor(bin.length / dim);
  const values = new Float32Array(count * dim);
  const signed = new Int8Array(bin.buffer, bin.byteOffset, count * dim);
  for (let i = 0; i < count; i++) {
    let mag = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) {
      const f = signed[off + j]! / scale;
      values[off + j] = f;
      mag += f * f;
    }
    mag = Math.sqrt(mag) || 1;
    for (let j = 0; j < dim; j++) values[off + j]! /= mag;
  }
  return { count, dim, values };
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const buf = (globalThis as any).Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
