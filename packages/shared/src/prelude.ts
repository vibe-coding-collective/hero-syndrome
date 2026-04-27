import type { Composition, SongMetadata } from './song';

export type PreludeTimePhase = 'early' | 'day' | 'gold' | 'dusk' | 'deep';
export type PreludeIntensity = 'dormant' | 'still' | 'gentle' | 'active' | 'intense';

export interface PreludeEntry {
  id: string;
  timePhase: PreludeTimePhase;
  intensity: PreludeIntensity;
  audioUrl: string;
  durationSec: number;
  composition: Composition;
  metadata: SongMetadata;
}

export interface PreludeManifest {
  version: string;
  preludes: PreludeEntry[];
}
