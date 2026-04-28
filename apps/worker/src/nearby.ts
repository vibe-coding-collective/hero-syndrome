import type { NearbyRes } from '@hero-syndrome/shared';
import { readJsonCache, roundCoord, writeJsonCache } from './kv';
import type { Env } from './types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const PRIMARY_TAG_KEYS = [
  'tourism',
  'historic',
  'amenity',
  'shop',
  'leisure',
  'natural',
  'railway',
  'aeroway',
  'man_made',
  'office',
  'craft',
] as const;

function pickPrimaryTag(tags: Record<string, string>): { category: string; type: string } | null {
  for (const k of PRIMARY_TAG_KEYS) {
    if (tags[k]) return { category: k, type: tags[k] };
  }
  return null;
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function nearbyPois(env: Env, lat: number, lon: number): Promise<NearbyRes> {
  const key = `poi:${roundCoord(lat)}:${roundCoord(lon)}`;
  const cached = await readJsonCache<NearbyRes>(env, key);
  if (cached) return cached;

  const radius = 500;
  const q = `[out:json][timeout:10];(\n` +
    `nwr(around:${radius},${lat},${lon})[tourism];\n` +
    `nwr(around:${radius},${lat},${lon})[historic];\n` +
    `nwr(around:${radius},${lat},${lon})[amenity];\n` +
    `nwr(around:${radius},${lat},${lon})[shop];\n` +
    `nwr(around:${radius},${lat},${lon})[leisure];\n` +
    `nwr(around:${radius},${lat},${lon})[natural~"water|beach|peak|wood|cliff|cave_entrance"];\n` +
    `nwr(around:${radius},${lat},${lon})[railway=station];\n` +
    `nwr(around:${radius},${lat},${lon})[aeroway];\n` +
    `nwr(around:${radius},${lat},${lon})[man_made~"tower|lighthouse|bridge|pier|windmill|water_tower|silo|monument"];\n` +
    `nwr(around:${radius},${lat},${lon})[office];\n` +
    `nwr(around:${radius},${lat},${lon})[craft];\n` +
    `);out center tags;`;

  let data: OverpassResponse;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'user-agent': env.USER_AGENT,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(q)}`,
    });
    if (!res.ok) {
      // empty array on upstream failure (degrades gracefully)
      const empty: NearbyRes = [];
      await writeJsonCache(env, key, empty, 60 * 60 * 6);
      return empty;
    }
    data = (await res.json()) as OverpassResponse;
  } catch {
    const empty: NearbyRes = [];
    await writeJsonCache(env, key, empty, 60 * 60 * 6);
    return empty;
  }

  const items: NearbyRes = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const tag = pickPrimaryTag(tags);
    if (!tag) continue;
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat == null || elLon == null) continue;
    const distanceM = haversineM(lat, lon, elLat, elLon);
    items.push({
      category: tag.category,
      type: tag.type,
      ...(tags.name ? { name: tags.name } : {}),
      distanceM: Math.round(distanceM),
    });
  }
  // Prefer named places at the top so "Tate Modern, 80 m" beats "amenity=bench, 12 m"
  items.sort((a, b) => {
    const aHasName = a.name ? 0 : 1;
    const bHasName = b.name ? 0 : 1;
    if (aHasName !== bHasName) return aHasName - bHasName;
    return a.distanceM - b.distanceM;
  });
  const top = items.slice(0, 5);
  await writeJsonCache(env, key, top, 60 * 60 * 24 * 30);
  return top;
}
