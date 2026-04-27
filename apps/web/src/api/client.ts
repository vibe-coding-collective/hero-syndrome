import type {
  CosmicRes,
  EpisodeRes,
  FinalizeReq,
  FinalizeRes,
  GenerateReq,
  GenerateRes,
  GeocodeRes,
  MeasuredFeaturesReq,
  NearbyRes,
  PreludeManifest,
  WeatherRes,
} from '@hero-syndrome/shared';

export type WorkerOrigin = string;

const API_PREFIX = ((import.meta as any).env?.VITE_API_BASE ?? '/api') as string;

async function jget<T>(path: string): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return (await res.json()) as T;
}

async function jpost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`${path} failed (${res.status}): ${text}`);
    (err as any).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const api = {
  generate: (body: GenerateReq) => jpost<GenerateRes>('/generate', body),
  finalize: (sessionId: string, body: FinalizeReq) =>
    jpost<FinalizeRes>(`/episode/${sessionId}/finalize`, body),
  episode: (id: string) => jget<EpisodeRes>(`/episode/${id}`),
  weather: (lat: number, lon: number) => jget<WeatherRes>(`/weather?lat=${lat}&lon=${lon}`),
  geocode: (lat: number, lon: number) => jget<GeocodeRes>(`/geocode?lat=${lat}&lon=${lon}`),
  nearby: (lat: number, lon: number) => jget<NearbyRes>(`/nearby?lat=${lat}&lon=${lon}`),
  cosmicGlobal: () => jget<CosmicRes>('/cosmic'),
  cosmicSession: (sessionId: string) => jget<CosmicRes>(`/session/${sessionId}/cosmic`),
  preludesManifest: () => jget<PreludeManifest>('/preludes/manifest.json'),
  recordSticker: (sessionId: string, emoji: string) =>
    jpost<{ ok: true }>(`/session/${sessionId}/sticker`, { emoji, placedAt: new Date().toISOString() }),
  recordMeasured: (sessionId: string, body: MeasuredFeaturesReq) =>
    jpost<{ ok: true }>(`/session/${sessionId}/measured`, body),
};

export function songStreamUrl(sessionId: string, songId: string): string {
  return `${API_PREFIX}/song/${sessionId}/${songId}`;
}

export function episodeSongStreamUrl(episodeId: string, songId: string): string {
  return `${API_PREFIX}/episode/${episodeId}/song/${songId}`;
}

export function preludeUrl(id: string): string {
  return `${API_PREFIX}/preludes/${id}.mp3`;
}
