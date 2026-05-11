import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MoonPhase,
  TimePhase,
  WeatherCondition,
} from './state';

export interface EnergyAxes {
  motion: number;
  density: number;
  tension: number;
  brightness: number;
}

export type MoodWeights = Record<string, number>;

export interface InspirationState {
  world: string;
  worldSecondary?: string;
  textureKeys: string[];
}

export interface StackedMeta {
  energy: EnergyAxes;
  mood: MoodWeights;
  inspiration: InspirationState;
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
  dayOfWeek: DayOfWeek;
  bodyActivity?: BodyActivity;
  locationType?: LocationType;
}
