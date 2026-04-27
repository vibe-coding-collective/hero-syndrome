export interface ApprovedPool {
  version: string;
  words: string[];
}

export interface ApprovedPoolEmbeddings {
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

export interface ProjectionMatrix {
  version: string;
  rows: number;
  cols: number;
  values: number[];
}

export interface FluxStats {
  version: string;
  channelMeans: number[];
  channelStddevs: number[];
}

export const STUB_VERSION = 'stub';

export function isStubPool(pool: { version: string }): boolean {
  return pool.version === STUB_VERSION;
}

/**
 * Decode quantized int8 base64 embeddings into a contiguous Float32Array
 * of `count * dim` elements. Pass an existing `data` field. Each float is
 * recovered as `byte / scale`. The output is L2-renormalized per row (the
 * source embeddings were normalized before quantization, but quantization
 * introduces a tiny denormalization that cosine similarity is sensitive to).
 */
export function decodeQuantizedEmbeddings(emb: ApprovedPoolEmbeddings): {
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
  // Reinterpret the raw bytes as signed int8.
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
  // Node fallback
  const buf = (globalThis as any).Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
