import { log } from './log';

const FLUX_URL = 'https://services.swpc.noaa.gov/json/goes/primary/differential-protons-7-day.json';

interface ProtonRecord {
  time_tag: string;
  satellite: number;
  flux: number;
  energy: string;
}

export interface FluxStats {
  version: string;
  channelMeans: number[];
  channelStddevs: number[];
  channels: string[];
}

export async function computeFluxStats(userAgent: string): Promise<FluxStats> {
  log('Fetching 7-day GOES proton flux');
  const res = await fetch(FLUX_URL, { headers: { 'user-agent': userAgent } });
  if (!res.ok) throw new Error(`flux fetch failed (${res.status})`);
  const arr = (await res.json()) as ProtonRecord[];
  const byEnergy = new Map<string, number[]>();
  for (const rec of arr) {
    if (typeof rec.flux !== 'number' || rec.flux <= 0) continue;
    if (!byEnergy.has(rec.energy)) byEnergy.set(rec.energy, []);
    byEnergy.get(rec.energy)!.push(Math.log10(rec.flux + 1e-6));
  }
  const channels = [...byEnergy.keys()].sort();
  log(`  ${channels.length} channels: ${channels.join(' | ')}`);
  const channelMeans: number[] = [];
  const channelStddevs: number[] = [];
  for (const c of channels) {
    const xs = byEnergy.get(c)!;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    let s = 0;
    for (const x of xs) s += (x - mean) ** 2;
    const std = Math.sqrt(s / xs.length) || 1;
    channelMeans.push(mean);
    channelStddevs.push(std);
  }
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: `7day.${today}`,
    channelMeans,
    channelStddevs,
    channels,
  };
}
