import { api } from '../api/client';
import type { GeocodeRes } from '@hero-syndrome/shared';

const MAX_AGE_MS = 60 * 60 * 1000;

interface Entry {
  lat: number;
  lon: number;
  res: GeocodeRes;
  fetchedAt: number;
}

const cache = new Map<string, Entry>();

function key(lat: number, lon: number): string {
  return `${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

export async function getGeocode(lat: number, lon: number): Promise<GeocodeRes> {
  const k = key(lat, lon);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.fetchedAt < MAX_AGE_MS) return hit.res;
  const res = await api.geocode(lat, lon);
  cache.set(k, { lat, lon, res, fetchedAt: Date.now() });
  return res;
}
