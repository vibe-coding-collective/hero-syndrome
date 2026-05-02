import { log } from './log';

const BATCH_SIZE = 96;

export interface EmbeddingResult {
  dim: number;
  embeddings: number[][]; // L2-normalized float vectors
}

interface WorkerEmbedResponse {
  embeddings: number[][];
}

export async function embedWordsViaWorker(opts: {
  workerUrl: string;
  devToken: string;
  words: string[];
  label: string;
}): Promise<EmbeddingResult> {
  const out: number[][] = [];
  let dim = 0;
  for (let i = 0; i < opts.words.length; i += BATCH_SIZE) {
    const batch = opts.words.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${opts.workerUrl}/admin/embed`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-debug-token': opts.devToken,
      },
      body: JSON.stringify({ texts: batch }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`embed request failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as WorkerEmbedResponse;
    for (const vec of data.embeddings) {
      let mag = 0;
      for (const v of vec) mag += v * v;
      mag = Math.sqrt(mag) || 1;
      const normed = vec.map((v) => v / mag);
      if (dim === 0) dim = normed.length;
      out.push(normed);
    }
    log(`  [${opts.label}] embedded ${Math.min(i + BATCH_SIZE, opts.words.length)}/${opts.words.length}`);
  }
  return { dim, embeddings: out };
}

export function quantizeToBase64(emb: EmbeddingResult, version: string): {
  version: string;
  dim: number;
  count: number;
  quantized: true;
  encoding: 'int8-base64';
  scale: number;
  data: string;
} {
  const N = emb.embeddings.length;
  const D = emb.dim;
  const ints = new Int8Array(N * D);
  for (let i = 0; i < N; i++) {
    const v = emb.embeddings[i]!;
    for (let j = 0; j < D; j++) {
      let q = Math.round(v[j]! * 127);
      if (q > 127) q = 127;
      if (q < -127) q = -127;
      ints[i * D + j] = q;
    }
  }
  const data = Buffer.from(ints.buffer).toString('base64');
  return { version, dim: D, count: N, quantized: true, encoding: 'int8-base64', scale: 127, data };
}
