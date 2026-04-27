import type { CosmicSnapshot } from '@hero-syndrome/shared';
import { deriveCosmicWord } from './cosmic/cosmicWord';
import { readJsonCache, writeJsonCache } from './kv';
import type { CosmicCachedAggregate, Env } from './types';

const SWPC_KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SWPC_PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json';
const SWPC_GOES_PROTON_URL = 'https://services.swpc.noaa.gov/json/goes/primary/differential-protons-6-hour.json';

interface GoesProtonRecord {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;
}

async function fetchKIndex(env: Env): Promise<number | null> {
  try {
    const res = await fetch(SWPC_KP_URL, { headers: { 'user-agent': env.USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const last = data[data.length - 1];
    let kRaw: number | null = null;
    if (last && typeof last === 'object' && !Array.isArray(last)) {
      const obj = last as Record<string, unknown>;
      const candidate = obj.Kp ?? obj.kp ?? obj.kp_index ?? obj.estimated_kp;
      if (typeof candidate === 'number') kRaw = candidate;
      else if (typeof candidate === 'string') kRaw = parseFloat(candidate);
    } else if (Array.isArray(last) && last.length >= 2) {
      kRaw = parseFloat(String(last[1]));
    }
    if (kRaw == null || Number.isNaN(kRaw)) return null;
    return Math.max(0, Math.min(9, Math.round(kRaw)));
  } catch {
    return null;
  }
}

async function fetchSolarWind(env: Env): Promise<{ speedKmS: number; density: number } | null> {
  try {
    const res = await fetch(SWPC_PLASMA_URL, { headers: { 'user-agent': env.USER_AGENT } });
    if (!res.ok) return null;
    const arr = (await res.json()) as string[][];
    if (arr.length < 2) return null;
    const headerRow = arr[0]!;
    const densityIdx = headerRow.findIndex((h) => /density/i.test(h));
    const speedIdx = headerRow.findIndex((h) => /speed/i.test(h));
    if (densityIdx < 0 || speedIdx < 0) return null;
    for (let i = arr.length - 1; i >= 1; i--) {
      const row = arr[i]!;
      const density = parseFloat(row[densityIdx]!);
      const speed = parseFloat(row[speedIdx]!);
      if (!Number.isNaN(density) && !Number.isNaN(speed)) {
        return { speedKmS: speed, density };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchGoesProtonFlux(env: Env): Promise<{ flux: number[]; fetchedAtUtc: string } | null> {
  try {
    const res = await fetch(SWPC_GOES_PROTON_URL, { headers: { 'user-agent': env.USER_AGENT } });
    if (!res.ok) return null;
    const arr = (await res.json()) as GoesProtonRecord[];
    if (arr.length === 0) return null;

    const byTime = new Map<string, GoesProtonRecord[]>();
    for (const rec of arr) {
      if (!byTime.has(rec.time_tag)) byTime.set(rec.time_tag, []);
      byTime.get(rec.time_tag)!.push(rec);
    }
    const sortedTimes = [...byTime.keys()].sort();
    for (let i = sortedTimes.length - 1; i >= 0; i--) {
      const t = sortedTimes[i]!;
      const recs = byTime.get(t)!;
      if (recs.length < 13) continue;
      const fetchedAtMs = new Date(t).getTime();
      if (Number.isNaN(fetchedAtMs)) continue;
      if (Date.now() - fetchedAtMs > 30 * 60 * 1000) continue; // stale
      const ordered = [...recs].sort((a, b) => a.energy.localeCompare(b.energy)).slice(0, 13);
      const flux = ordered.map((r) => r.flux);
      return { flux, fetchedAtUtc: t };
    }
    return null;
  } catch {
    return null;
  }
}

const COSMIC_CACHE_KEY = (): string => `swpc:${Math.floor(Date.now() / (1000 * 60 * 30))}`;

export async function getCosmic(env: Env): Promise<CosmicSnapshot> {
  const cacheKey = COSMIC_CACHE_KEY();
  const cached = await readJsonCache<CosmicCachedAggregate>(env, cacheKey);
  if (cached) return cached.cosmic;

  const [kIndex, solarWind, protonFlux] = await Promise.all([
    fetchKIndex(env),
    fetchSolarWind(env),
    fetchGoesProtonFlux(env),
  ]);

  const cosmic: CosmicSnapshot = {};
  if (kIndex !== null && solarWind) {
    cosmic.spaceWeather = {
      kIndex,
      solarWindSpeedKmS: solarWind.speedKmS,
      solarWindDensity: solarWind.density,
    };
  } else if (kIndex !== null) {
    cosmic.spaceWeather = {
      kIndex,
      solarWindSpeedKmS: 0,
      solarWindDensity: 0,
    };
  }

  if (protonFlux) {
    const word = await deriveCosmicWord(env, protonFlux.flux, protonFlux.fetchedAtUtc);
    if (word) cosmic.cosmicWord = word;
  }

  const payload: CosmicCachedAggregate = {
    cachedAt: new Date().toISOString(),
    cosmic,
  };
  await writeJsonCache(env, cacheKey, payload, 60 * 30);
  return cosmic;
}
