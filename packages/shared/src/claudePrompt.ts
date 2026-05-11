import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MoonPhase,
  TimePhase,
  WeatherCondition,
} from './state';
import type { MeasuredFeatures, SongMetadata } from './song';
import type { StackedMeta } from './musicalPicks';

/**
 * The single JSON object embedded in the user message when calling Claude
 * for `compose_song`. Built by `buildClaudePromptJson` in the LLM package.
 *
 * Per option b-i: Claude receives the StackedMeta + RenderPlan as structured
 * context plus a compact lexicon vocabulary subset, then writes the final
 * `composition_plan` (overallPrompt + sections) itself.
 */
export interface ClaudePromptJson {
  state: {
    timestamp: string;
    time: {
      hour: number;
      phase: TimePhase;
      dayOfWeek: DayOfWeek;
    };
    moonPhase: MoonPhase;
    body?: {
      activity: BodyActivity;
    };
    location?: {
      type: LocationType;
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
  /** Stacked numeric meta + BPM/duration target. Claude composes around these. */
  stacked: StackedMeta;
  renderPlan: {
    bpm: number;
    totalDurationMs: number;
  };
  /** Compact subset of lexicon phrases relevant to this song's stacked meta. */
  lexicon: LexiconContextDict;
  vibes: {
    phraseOfTheMoment?: string;
  };
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
}

export interface WeatherLexEntry {
  scene: string[];
  texture_hints: string[];
}

export interface LexiconContextDict {
  product_positives: string[];
  product_negatives: string[];
  worlds: Record<string, string[]>;
  textures: Record<string, string[]>;
  moods: Record<string, string[]>;
  weather: WeatherLexEntry;
  moon_undertow: string[];
  moon_tide_dynamics: Record<'high_spring' | 'mid' | 'low_neap', string[]>;
  day: string[];
  body?: string[];
  location?: string[];
  negatives_fixed: string[];
}
