import type {
  BodyActivity,
  CosmicSnapshot,
  LocationType,
  StateVector,
} from './state';
import type {
  Composition,
  MeasuredFeatures,
  PhraseOfTheMoment,
  QuantumBytes,
  SongMetadata,
} from './song';
import type { RenderPlan, StackedMeta } from './musicalPicks';

export interface SongRecord {
  songId: string;
  startedAt: string;
  durationSec: number;
  metadata: SongMetadata;
  composition: Composition;
  measuredFeatures?: MeasuredFeatures;
  stateVector: StateVector;
  quantumBytes: QuantumBytes;
  phraseOfTheMoment?: PhraseOfTheMoment;
  /** Stacked numeric meta for the song. Replaces legacy `musicalPicks`. */
  stacked?: StackedMeta;
  /** BPM, duration target, body, day, location. */
  renderPlan?: RenderPlan;
  /** Classified location (1-of-50 + unknown). */
  locationType?: LocationType;
  /** Body activity at song time (sensor-derived). */
  bodyActivity?: BodyActivity;
}

export interface SessionRecord {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  cosmic?: CosmicSnapshot;
  songs: SongRecord[];
}

export interface QuantumReceipt {
  totalBytesConsumed: number;
  source: 'qrng' | 'mixed' | 'pseudo';
}

export interface EpisodeRecord extends SessionRecord {
  episodeId: string;
  title: string;
  quantumReceipt: QuantumReceipt;
}
