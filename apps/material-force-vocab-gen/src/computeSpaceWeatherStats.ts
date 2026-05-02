import { log } from './log';

const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const PLASMA_URL = 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json';

export interface SpaceWeatherStats {
  version: string;
  kIndexMean: number;
  kIndexStddev: number;
  solarWindSpeedMean: number;
  solarWindSpeedStddev: number;
  solarWindDensityMean: number;
  solarWindDensityStddev: number;
  calibrationFromUtc?: string;
  calibrationToUtc?: string;
}

function meanStd(xs: number[]): { mean: number; stddev: number } {
  if (xs.length === 0) return { mean: 0, stddev: 1 };
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  let s = 0;
  for (const x of xs) s += (x - mean) ** 2;
  const stddev = Math.sqrt(s / xs.length) || 1;
  return { mean, stddev };
}

async function fetchKp(userAgent: string): Promise<{ values: number[]; from?: string; to?: string }> {
  const res = await fetch(KP_URL, { headers: { 'user-agent': userAgent } });
  if (!res.ok) throw new Error(`kp fetch ${res.status}`);
  const arr = (await res.json()) as Array<Record<string, unknown> | unknown[]>;
  const values: number[] = [];
  let from: string | undefined;
  let to: string | undefined;
  for (const row of arr) {
    let v: unknown;
    let t: unknown;
    if (Array.isArray(row)) {
      t = row[0];
      v = row[1];
    } else {
      v = row.Kp ?? row.kp ?? row.kp_index ?? row.estimated_kp;
      t = row.time_tag ?? row.time;
    }
    const num = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
    if (Number.isFinite(num)) values.push(num);
    if (typeof t === 'string') {
      if (!from) from = t;
      to = t;
    }
  }
  return { values, from, to };
}

async function fetchPlasma(userAgent: string): Promise<{ speed: number[]; density: number[] }> {
  const res = await fetch(PLASMA_URL, { headers: { 'user-agent': userAgent } });
  if (!res.ok) throw new Error(`plasma fetch ${res.status}`);
  const arr = (await res.json()) as string[][];
  if (arr.length < 2) return { speed: [], density: [] };
  const headers = arr[0]!;
  const densityIdx = headers.findIndex((h) => /density/i.test(h));
  const speedIdx = headers.findIndex((h) => /speed/i.test(h));
  if (densityIdx < 0 || speedIdx < 0) return { speed: [], density: [] };
  const density: number[] = [];
  const speed: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    const row = arr[i]!;
    const d = parseFloat(row[densityIdx]!);
    const s = parseFloat(row[speedIdx]!);
    if (Number.isFinite(d) && d > 0) density.push(d);
    if (Number.isFinite(s) && s > 0) speed.push(s);
  }
  return { speed, density };
}

export async function computeSpaceWeatherStats(userAgent: string): Promise<SpaceWeatherStats> {
  log('Fetching NOAA SWPC K-index history');
  const kp = await fetchKp(userAgent);
  log(`  ${kp.values.length} K-index samples`);
  log('Fetching NOAA SWPC 7-day solar-wind plasma');
  const plasma = await fetchPlasma(userAgent);
  log(`  ${plasma.speed.length} speed samples, ${plasma.density.length} density samples`);

  const k = meanStd(kp.values);
  const s = meanStd(plasma.speed);
  const d = meanStd(plasma.density);

  const today = new Date().toISOString().slice(0, 10);
  const out: SpaceWeatherStats = {
    version: `swpc.${today}`,
    kIndexMean: k.mean,
    kIndexStddev: k.stddev,
    solarWindSpeedMean: s.mean,
    solarWindSpeedStddev: s.stddev,
    solarWindDensityMean: d.mean,
    solarWindDensityStddev: d.stddev,
  };
  if (kp.from) out.calibrationFromUtc = kp.from;
  if (kp.to) out.calibrationToUtc = kp.to;
  return out;
}
