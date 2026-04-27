import type { GeocodeRes } from '@hero-syndrome/shared';
import { derivePlaceBundle, type NominatimResult } from './derivations/placeType';
import { readJsonCache, roundCoord, writeJsonCache } from './kv';
import type { Env } from './types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

export async function reverseGeocode(env: Env, lat: number, lon: number): Promise<GeocodeRes> {
  const key = `geo:${roundCoord(lat)}:${roundCoord(lon)}`;
  const cached = await readJsonCache<GeocodeRes>(env, key);
  if (cached) return cached;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('extratags', '1');
  const res = await fetch(url, {
    headers: {
      'user-agent': env.USER_AGENT,
      'accept-language': 'en',
    },
  });
  if (!res.ok) throw new Error(`nominatim failed (${res.status})`);
  const data = (await res.json()) as NominatimResult;
  const out: GeocodeRes = derivePlaceBundle(data);
  // 30-day cache
  await writeJsonCache(env, key, out, 60 * 60 * 24 * 30);
  return out;
}
