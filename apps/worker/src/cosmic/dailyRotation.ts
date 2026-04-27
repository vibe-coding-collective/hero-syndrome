import poolData from '@hero-syndrome/cosmic-vocab/approved-pool.json';
import projectionData from '@hero-syndrome/cosmic-vocab/projection.json';
import { isStubPool, type ApprovedPool, type ProjectionMatrix } from '@hero-syndrome/cosmic-vocab';
import type { Env } from '../types';
import { utcDateString, type DailyVocab } from './cosmicWord';

const POOL = poolData as ApprovedPool;
const PROJECTION = projectionData as ProjectionMatrix;

const DAILY_VOCAB_SIZE = 256;
const VOCAB_KV_TTL_SECONDS = 60 * 60 * 24 * 30;

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function fisherYatesPartial(n: number, k: number, seedBytes: Uint8Array): number[] {
  const indices = Array.from({ length: n }, (_, i) => i);
  let cursor = 0;
  const len = seedBytes.length;
  const next16 = (): number => {
    if (cursor + 1 >= len) cursor = 0;
    const a = seedBytes[cursor]!;
    const b = seedBytes[cursor + 1]!;
    cursor += 2;
    return (a << 8) | b;
  };
  const target = Math.min(k, n);
  for (let i = 0; i < target; i++) {
    const r = next16() % (n - i);
    const j = i + r;
    const tmpI = indices[i]!;
    const tmpJ = indices[j]!;
    indices[i] = tmpJ;
    indices[j] = tmpI;
  }
  return indices.slice(0, target);
}

export async function rotateDailyVocab(env: Env): Promise<{ ok: true; date: string } | { ok: false; reason: string }> {
  if (isStubPool(POOL)) {
    return { ok: false, reason: 'pool is stub; run cosmic-vocab-gen before scheduling rotations' };
  }
  if (POOL.words.length < DAILY_VOCAB_SIZE) {
    return { ok: false, reason: `pool too small (${POOL.words.length} < ${DAILY_VOCAB_SIZE})` };
  }

  const id = env.QUANTUM_DO.idFromName('reservoir');
  const stub = env.QUANTUM_DO.get(id);
  const res = await stub.fetch('https://quantum/pull?n=512');
  if (!res.ok) return { ok: false, reason: `quantum pull failed (${res.status})` };
  const body = (await res.json()) as { bytes: number[]; source: string };
  const seedBytes = new Uint8Array(body.bytes);

  const indices = fisherYatesPartial(POOL.words.length, DAILY_VOCAB_SIZE, seedBytes);
  const date = utcDateString();
  const vocab: DailyVocab = {
    date,
    indices,
    vocabSeed: bytesToHex(seedBytes),
    generatedAtUtc: new Date().toISOString(),
    poolVersion: POOL.version,
    projectionVersion: PROJECTION.version,
  };
  await env.EPISODES.put(`cosmic-vocab:${date}`, JSON.stringify(vocab), {
    expirationTtl: VOCAB_KV_TTL_SECONDS,
  });
  return { ok: true, date };
}
