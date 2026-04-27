import type { Env } from './types';

export function sessionSongKey(sessionId: string, songId: string): string {
  return `sessions/${sessionId}/songs/${songId}.mp3`;
}

export function episodeSongKey(episodeId: string, songId: string): string {
  return `episodes/${episodeId}/songs/${songId}.mp3`;
}

export function preludeKey(id: string): string {
  return `preludes/${id}.mp3`;
}

export function preludeManifestKey(): string {
  return 'preludes/manifest.json';
}

export async function streamObject(env: Env, key: string): Promise<Response> {
  const obj = await env.AUDIO.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const headers = new Headers();
  headers.set('content-type', obj.httpMetadata?.contentType ?? 'audio/mpeg');
  if (obj.size) headers.set('content-length', String(obj.size));
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('accept-ranges', 'bytes');
  return new Response(obj.body, { status: 200, headers });
}

export async function moveObject(env: Env, fromKey: string, toKey: string): Promise<void> {
  const obj = await env.AUDIO.get(fromKey);
  if (!obj) throw new Error(`R2 source missing: ${fromKey}`);
  const buf = await obj.arrayBuffer();
  await env.AUDIO.put(toKey, buf, {
    httpMetadata: { contentType: obj.httpMetadata?.contentType ?? 'audio/mpeg' },
  });
  await env.AUDIO.delete(fromKey);
}

export async function copyObject(env: Env, fromKey: string, toKey: string): Promise<void> {
  const obj = await env.AUDIO.get(fromKey);
  if (!obj) throw new Error(`R2 source missing: ${fromKey}`);
  const buf = await obj.arrayBuffer();
  await env.AUDIO.put(toKey, buf, {
    httpMetadata: { contentType: obj.httpMetadata?.contentType ?? 'audio/mpeg' },
  });
}
