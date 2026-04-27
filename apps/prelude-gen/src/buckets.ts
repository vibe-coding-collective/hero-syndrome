import type { PreludeIntensity, PreludeTimePhase } from '@hero-syndrome/shared';

export const TIME_PHASES: PreludeTimePhase[] = ['early', 'day', 'gold', 'dusk', 'deep'];
export const INTENSITIES: PreludeIntensity[] = ['dormant', 'still', 'gentle', 'active', 'intense'];

export function bucketId(phase: PreludeTimePhase, intensity: PreludeIntensity): string {
  return `${phase}_${intensity}`;
}

export const BUCKET_IDS: string[] = TIME_PHASES.flatMap((p) =>
  INTENSITIES.map((i) => bucketId(p, i)),
);
