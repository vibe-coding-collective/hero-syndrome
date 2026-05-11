import type { CosmicSnapshot, StateVector, WeatherCondition } from './state';
import type {
  Composition,
  MeasuredFeatures,
  QuantumBytes,
  SongMetadata,
  TransitionIntent,
} from './song';
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
