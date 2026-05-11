import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MoonPhase,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';

export interface EnergyAxes {
  motion: number;
  density: number;
  tension: number;
  brightness: number;
}

/** Weighted mood tags after stacking (0–1). */
export type MoodWeights = Record<string, number>;

export interface InspirationState {
  /** Primary world id (`data/lexicon/world.json`). */
  world: string;
  /** Secondary world from weather blend, if any. */
  worldSecondary?: string;
  /** Texture cue ids (`data/lexicon/texture.json`). */
  textureKeys: string[];
}

/** Output of modifier stacking (numeric + symbolic). */
export interface StackedMeta {
  energy: EnergyAxes;
  mood: MoodWeights;
  inspiration: InspirationState;
  /** Effective tide multiplier applied to fast mood deltas. */
  tideEffective: number;
  weatherCondition: WeatherCondition;
  timePhase: TimePhase;
  moonPhase: MoonPhase;
}

export interface RenderPlan {
  meta: StackedMeta;
  bpm: number;
  totalDurationMs: number;
  seed: string;
  bodyActivity?: BodyActivity;
  dayOfWeek: DayOfWeek;
  locationType?: LocationType;
}

export interface PipelineInput {
  timePhase: TimePhase;
  dayOfWeek: DayOfWeek;
  weatherCondition: WeatherCondition;
  moonPhase: MoonPhase;
  bodyActivity?: BodyActivity;
  locationType?: LocationType;
}

export interface PipelineOptions {
  /** Stable seed string. Same inputs + same seed ⇒ same plan. */
  seed?: string;
  /** Default 0.8 per spec (`lunarStrength` ∈ [0.6, 1.0]). */
  lunarStrength?: number;
  /** When undertow is not supplied, scale moon undertow targets (default 0.65). */
  undertowInstantStrength?: number;
  /** Smoothed undertow mood; if provided, overrides synthesized undertow. */
  undertowSmooth?: MoodWeights;
  /** Default 60000ms. */
  totalDurationMs?: number;
}

export interface MetaToPlanResult {
  stacked: StackedMeta;
  renderPlan: RenderPlan;
}
