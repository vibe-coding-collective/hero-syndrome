import { api } from '../api/client';
import type { WeatherRes } from '@hero-syndrome/shared';

const REFRESH_MS = 10 * 60 * 1000;
const MIN_DISTANCE_M = 50;

interface CacheEntry {
  reading: WeatherRes;
  fetchedAt: number;
  lat: number;
  lon: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<WeatherRes> | null = null;

function distanceM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

export async function getWeather(lat: number, lon: number): Promise<WeatherRes> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < REFRESH_MS && distanceM(cache, { lat, lon }) < MIN_DISTANCE_M) {
    return cache.reading;
  }
  if (inflight) return inflight;
  inflight = api.weather(lat, lon).then((reading) => {
    cache = { reading, fetchedAt: Date.now(), lat, lon };
    inflight = null;
    return reading;
  }).catch((err) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

export function lastWeather(): WeatherRes | null {
  return cache?.reading ?? null;
}
