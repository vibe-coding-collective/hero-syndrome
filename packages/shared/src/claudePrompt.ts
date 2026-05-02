import type { DayOfWeek, MotionClass, MovementPattern, PlaceType, TimePhase, WeatherCondition } from './state';
import type { MeasuredFeatures, SongMetadata } from './song';

/**
 * The single JSON object embedded in the user message when calling Claude
 * for `compose_song`. Built by `buildClaudePromptJson` in the LLM package
 * from the raw StateVector + cosmic snapshot + recent history. Not the
 * same shape as StateVector — this is the Claude-facing presentation.
 */
export interface ClaudePromptJson {
  state: {
    timestamp: string;
    time: {
      hour: number;
      phase: TimePhase;
      dayOfWeek: DayOfWeek;
    };
    body: {
      activity: MotionClass;
      motion: MovementPattern;
      intensity: 'low' | 'moderate' | 'high';
    };
    location?: {
      placeType?: PlaceType;
      place?: {
        type: string;
        name?: string;
      };
      city?: string;
      country?: string;
      nearby?: Array<{
        category: string;
        type: string;
        name?: string;
        distanceM: number;
      }>;
    };
    weather?: {
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
    };
  };
  userInput: unknown[];
  vibes: {
    wordOfTheMoment?: string;
    phraseOfTheMoment?: string;
  };
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
}
