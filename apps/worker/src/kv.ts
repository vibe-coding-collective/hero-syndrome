import type { EpisodeRecord } from '@hero-syndrome/shared';
import type { Env } from './types';

export async function readEpisode(env: Env, episodeId: string): Promise<EpisodeRecord | null> {
  return env.EPISODES.get<EpisodeRecord>(`episode:${episodeId}`, 'json');
}

export async function writeEpisode(env: Env, record: EpisodeRecord): Promise<void> {
  await env.EPISODES.put(`episode:${record.episodeId}`, JSON.stringify(record));
}

export async function readJsonCache<T>(env: Env, key: string): Promise<T | null> {
  return env.EPISODES.get<T>(key, 'json');
}

export async function writeJsonCache<T>(
  env: Env,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await env.EPISODES.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}

export function roundCoord(n: number, decimals = 3): string {
  return n.toFixed(decimals);
}
