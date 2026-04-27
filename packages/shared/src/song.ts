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
