export interface ApprovedPool {
  version: string;
  words: string[];
}

export interface ApprovedPoolEmbeddings {
  version: string;
  dim: number;
  quantized: boolean;
  embeddings: number[][];
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
