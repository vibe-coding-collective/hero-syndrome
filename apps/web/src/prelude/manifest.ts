import type { PreludeEntry, PreludeManifest, PreludeIntensity, PreludeTimePhase } from '@hero-syndrome/shared';
import { api } from '../api/client';

let cached: PreludeManifest | null = null;

export async function loadPreludesManifest(): Promise<PreludeManifest> {
  if (cached) return cached;
  try {
    cached = await api.preludesManifest();
  } catch {
    cached = { version: 'unavailable', preludes: [] };
  }
  return cached;
}

export function bucketForState(intensityNormalized: number, phase: string): { phase: PreludeTimePhase; intensity: PreludeIntensity } {
  const intensity: PreludeIntensity = intensityNormalized < 0.2
    ? 'dormant'
    : intensityNormalized < 0.4
      ? 'still'
      : intensityNormalized < 0.6
        ? 'gentle'
        : intensityNormalized < 0.8
          ? 'active'
          : 'intense';
  let timePhase: PreludeTimePhase;
  switch (phase) {
    case 'dawn':
    case 'morning':
      timePhase = 'early';
      break;
    case 'noon':
    case 'afternoon':
      timePhase = 'day';
      break;
    case 'goldenHour':
      timePhase = 'gold';
      break;
    case 'dusk':
    case 'night':
      timePhase = 'dusk';
      break;
    case 'witchingHour':
      timePhase = 'deep';
      break;
    default:
      timePhase = 'day';
  }
  return { phase: timePhase, intensity };
}

export function pickPrelude(manifest: PreludeManifest, intensityNormalized: number, phase: string): PreludeEntry | null {
  if (manifest.preludes.length === 0) return null;
  const target = bucketForState(intensityNormalized, phase);
  const exact = manifest.preludes.find((p) => p.timePhase === target.phase && p.intensity === target.intensity);
  if (exact) return exact;
  const phaseOnly = manifest.preludes.find((p) => p.timePhase === target.phase);
  if (phaseOnly) return phaseOnly;
  return manifest.preludes[0] ?? null;
}
