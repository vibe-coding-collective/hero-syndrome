import type { DayOfWeek, MotionClass, MovementPattern, TimePhase, WeatherCondition } from './state';

/** Bucket names for continuous-weather inputs. Tied to the schema design;
 *  if the schema bucketing changes (e.g. adds a "freezing" temp bucket),
 *  these update with it. */
export type TempCBucket = 'cold' | 'cool' | 'mild' | 'warm' | 'hot';
export type HumidityBucket = 'dry' | 'moderate' | 'humid';
export type PrecipitationBucket = 'none' | 'light' | 'moderate' | 'heavy';
export type CloudCoverBucket = 'clear' | 'partial' | 'overcast';
export type WindBucket = 'calm' | 'breezy' | 'windy' | 'gale';
export type ThresholdBucket = 'nearSunrise' | 'nearSunset';
export type IntensityBucket = 'low' | 'moderate' | 'high';

/** What was picked for a song from `@hero-syndrome/musical-schema`. Persisted
 *  on each SongRecord for episode replays + provenance. The picks themselves
 *  are quantum-byte-driven; the inputs document which schema rows they came
 *  from. */
export interface MusicalPicks {
  schemaVersion: string;
  inputs: {
    phase: TimePhase;
    dayOfWeek: DayOfWeek;
    condition?: WeatherCondition;
    tempCBucket?: TempCBucket;
    humidityBucket?: HumidityBucket;
    precipitationBucket?: PrecipitationBucket;
    cloudCoverBucket?: CloudCoverBucket;
    windBucket?: WindBucket;
    isDay?: boolean;
    threshold?: ThresholdBucket;
    activity: MotionClass;
    motion: MovementPattern;
    intensity: IntensityBucket;
  };
  picks: {
    tempo: number;
    key: string;
    instrumentationBase: string;
    dayAccent: string;
    reverb?: string;
    dynamics?: string;
    color?: string;
    tonalWarmth?: string;
    airDensity?: string;
    textureOverlay?: string;
    brightnessMask?: string;
    motionModulation?: string;
    lighting?: string;
    thresholdAccent?: string;
    tempoAdjustment: number;
    articulation: string;
    phraseShape: string;
    dynamicRange: string;
  };
  derived: {
    finalBpm: number;
    tempoTerm: string;
  };
}
