export type TransitionIntent = 'continue' | 'evolve' | 'shift' | 'break';

export interface SongMetadata {
  bpmRange: [number, number];
  key: string;
  intensity: number;
  instrumentation: string[];
  genreTags: string[];
  transitionIntent: TransitionIntent;
}

export interface CompositionSection {
  label: string;
  durationSec: number;
  prompt: string;
}

export interface Composition {
  overallPrompt: string;
  sections: CompositionSection[];
}

export interface MeasuredFeatures {
  bpmEstimate: number;
  spectralCentroidHz: number;
  rmsLoudness: number;
  durationSec: number;
}

export interface QuantumBytes {
  bytes: number[];
  source: 'qrng' | 'mixed' | 'pseudo';
}

/** Per-song "phrase of the moment" — material + force, sampled from open-text
 *  vocabularies and conditioned on current space weather, ordered by a
 *  per-song quantum byte. See `apps/worker/src/cosmic/phraseOfTheMoment.ts`
 *  for derivation. */
export interface PhraseOfTheMoment {
  phrase: string;
  material: string;
  force: string;
  wordOrder: 'force-material' | 'material-force';
  pools: {
    materialVersion: string;
    forceVersion: string;
  };
}
