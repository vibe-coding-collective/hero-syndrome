import type {
  BodyActivity,
  CosmicSnapshot,
  LocationType,
  StateVector,
  WeatherCondition,
} from './state';
import type {
  Composition,
  MeasuredFeatures,
  PhraseOfTheMoment,
  QuantumBytes,
  SongMetadata,
  TransitionIntent,
} from './song';
import type { RenderPlan, StackedMeta } from './musicalPicks';
import type { EpisodeRecord, QuantumReceipt } from './session';

export interface GenerateReq {
  sessionId: string;
  stateVector: StateVector;
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
}

export interface GenerateRes {
  songId: string;
  songUrl: string;
  metadata: SongMetadata;
  composition: Composition;
  durationSec: number;
  /** Snapshot of the state vector that was fed into the Claude prompt for this
   *  song. Surfaced to the client so the dial UI can visualize "what Claude
   *  saw" rather than re-deriving from local sensors. */
  stateVector: StateVector;
  /** Stacked numeric meta (energy, mood, inspiration). */
  stacked: StackedMeta;
  /** BPM + duration budget. */
  renderPlan: RenderPlan;
  /** Classified 1-of-50 location. */
  locationType: LocationType;
  /** Body activity at song time. */
  bodyActivity: BodyActivity;
  /** Optional cosmic-conditioned phrase pair. */
  phraseOfTheMoment?: PhraseOfTheMoment;
}

export interface FinalizeReq {
  title?: string;
  endedAt: string;
}

export interface FinalizeRes {
  episodeId: string;
  shareUrl: string;
}

export interface WeatherRes {
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  condition: WeatherCondition;
  precipitationMmHr: number;
  cloudCoverPct: number;
  windMps: number;
  isDay: boolean;
  sunriseProximityMin: number;
  sunsetProximityMin: number;
}

/** Raw reverse-geocode response. The Claude classification step turns this
 *  (and `nearby`) into one of the 50 `LocationType` ids. */
export interface GeocodeRes {
  place?: { category: string; type: string; name?: string };
  road?: { class: string; name?: string };
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

export type NearbyRes = Array<{
  category: string;
  type: string;
  name?: string;
  distanceM: number;
}>;

export type CosmicRes = CosmicSnapshot;

export interface EpisodeRes extends EpisodeRecord {}

export interface MeasuredFeaturesReq {
  songId: string;
  features: MeasuredFeatures;
}

export type { TransitionIntent, MeasuredFeatures, QuantumBytes, QuantumReceipt };
