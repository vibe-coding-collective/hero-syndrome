import { api } from '../api/client';
import type { NearbyRes } from '@hero-syndrome/shared';

const MIN_DISTANCE_M = 50;

interface Entry {
  lat: number;
  lon: number;
  res: NearbyRes;
  fetchedAt: number;
}

let last: Entry | null = null;

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

export async function getNearby(lat: number, lon: number): Promise<NearbyRes> {
  if (last && distanceM(last, { lat, lon }) < MIN_DISTANCE_M) return last.res;
  const res = await api.nearby(lat, lon);
  last = { lat, lon, res, fetchedAt: Date.now() };
  return res;
}
