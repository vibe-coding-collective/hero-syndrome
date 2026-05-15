import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MovementPattern,
  StateVector,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';
import type { PlayedSong as StorePlayedSong } from '../state/store';

export type DemoDialPreset = 'day' | 'rain' | 'night';

export interface DemoDialInput {
  hour: number;
  preset: DemoDialPreset;
  progress: number;
  revision: number;
  nowMs: number;
}

const DAY_OF_WEEK: DayOfWeek = 'Friday';
const DEMO_DURATION_SEC = 126;
const HONG_KONG_COORDS = { lat: 22.284, lon: 114.158 };

export function createDemoDialSong(input: DemoDialInput): StorePlayedSong {
  const hour = normalizeHour(input.hour);
  const isNight = input.preset === 'night' || hour < 6.1 || hour >= 18.7;
  const condition = weatherForPreset(input.preset, isNight);
  const bodyActivity = bodyForPreset(input.preset);
  const pattern = patternForActivity(bodyActivity);
  const intensityNormalized = input.preset === 'night' ? 0.22 : input.preset === 'rain' ? 0.58 : 0.72;
  const timestamp = dateForDemoHour(hour).toISOString();
  const effectiveDurationMs = Math.max(1, DEMO_DURATION_SEC - 5) * 1000;
  const startedAt = input.nowMs - clamp01(input.progress) * effectiveDurationMs;
  const stateVector: StateVector = {
    timestamp,
    time: {
      hour,
      phase: phaseForHour(hour),
      dayOfWeek: DAY_OF_WEEK,
    },
    weather: {
      tempC: isNight ? 24 : input.preset === 'rain' ? 26 : 29,
      feelsLikeC: isNight ? 25 : input.preset === 'rain' ? 28 : 31,
      humidityPct: input.preset === 'rain' ? 88 : isNight ? 76 : 67,
      condition,
      precipitationMmHr: input.preset === 'rain' ? 1.8 : 0,
      cloudCoverPct: input.preset === 'rain' ? 92 : isNight ? 38 : 22,
      windMps: input.preset === 'rain' ? 6.2 : 3.1,
      isDay: !isNight,
      sunriseProximityMin: Math.round((hour - 6.05) * 60),
      sunsetProximityMin: Math.round((hour - 18.65) * 60),
    },
    location: {
      speedMps: bodyActivity === 'running' ? 2.8 : bodyActivity === 'walking' ? 1.2 : 0.1,
      bodyActivity,
      coords: HONG_KONG_COORDS,
      place: {
        category: input.preset === 'night' ? 'amenity' : 'leisure',
        type: input.preset === 'night' ? 'bar' : 'park',
        name: input.preset === 'night' ? 'Morrison Hill' : 'Victoria Park',
      },
      road: {
        class: 'tertiary',
        name: input.preset === 'night' ? 'Morrison Hill Road' : 'Causeway Road',
      },
      nearby: [
        { category: 'leisure', type: 'park', name: 'Victoria Park', distanceM: 48 },
        { category: 'amenity', type: 'cafe', name: 'Morning Glass', distanceM: 96 },
        { category: 'public_transport', type: 'station', name: 'Causeway Bay', distanceM: 180 },
        { category: 'natural', type: 'water', name: 'Typhoon Shelter', distanceM: 420 },
      ],
      neighborhood: 'Causeway Bay',
      city: 'Hong Kong',
      state: 'Hong Kong',
      country: 'Hong Kong',
      countryCode: 'hk',
    },
    movement: {
      intensityNormalized,
      pattern,
    },
    cosmic: {
      spaceWeather: {
        kIndex: input.preset === 'night' ? 4 : 2,
        solarWindSpeedKmS: input.preset === 'rain' ? 486 : 421,
        solarWindDensity: input.preset === 'night' ? 7.1 : 4.8,
      },
      cosmicWord: {
        word: input.preset === 'night' ? 'morracium' : 'calcium',
        flux: [0.4, 0.1, 0.8, 0.2],
        method: 'random-projection-bge-small',
        source: 'pseudo',
        fetchedAtUtc: timestamp,
        vocabDate: '2026-05-15',
        vocabSeed: 'sandbox',
      },
    },
  };

  const bpm = input.preset === 'night' ? 82 : input.preset === 'rain' ? 108 : 132;
  const mood = moodForPreset(input.preset);
  const locationType = locationTypeForPreset(input.preset);

  return {
    songId: `disk-ui-sandbox-${input.preset}-${input.revision}`,
    songUrl: '',
    durationSec: DEMO_DURATION_SEC,
    startedAt,
    source: 'generated',
    metadata: {
      bpmRange: [Math.max(55, bpm - 12), bpm + 12],
      key: input.preset === 'night' ? 'D minor' : input.preset === 'rain' ? 'A dorian' : 'G major',
      intensity: intensityNormalized,
      instrumentation: input.preset === 'night'
        ? ['soft synths', 'brushed percussion', 'low piano']
        : ['mallets', 'warm bass', 'granular strings'],
      genreTags: input.preset === 'night' ? ['ambient', 'downtempo'] : ['leftfield pop', 'motion score'],
      transitionIntent: input.preset === 'rain' ? 'shift' : 'evolve',
    },
    composition: {
      overallPrompt: `Sandbox ${input.preset} composition for dial UI work.`,
      sections: [
        {
          label: 'opening',
          durationSec: DEMO_DURATION_SEC,
          prompt: 'A local static composition placeholder used only by the isolated dial UI route.',
        },
      ],
    },
    stateVector,
    stacked: {
      energy: {
        motion: intensityNormalized,
        density: input.preset === 'night' ? 0.36 : 0.72,
        tension: input.preset === 'rain' ? 0.64 : 0.42,
        brightness: isNight ? 0.18 : 0.82,
      },
      mood,
      inspiration: {
        world: input.preset === 'night' ? 'after-hours city' : 'humid urban morning',
        worldSecondary: input.preset === 'rain' ? 'rain on glass' : 'open-air transit',
        textureKeys: input.preset === 'night' ? ['soft', 'nocturnal'] : ['glossy', 'kinetic'],
      },
      tideEffective: input.preset === 'night' ? 0.72 : 0.44,
      weatherCondition: condition,
      timePhase: phaseForHour(hour),
      moonPhase: input.preset === 'night' ? 'waxing_gibbous' : 'first_quarter',
    },
    renderPlan: {
      meta: {
        energy: {
          motion: intensityNormalized,
          density: input.preset === 'night' ? 0.36 : 0.72,
          tension: input.preset === 'rain' ? 0.64 : 0.42,
          brightness: isNight ? 0.18 : 0.82,
        },
        mood,
        inspiration: {
          world: input.preset === 'night' ? 'after-hours city' : 'humid urban morning',
          worldSecondary: input.preset === 'rain' ? 'rain on glass' : 'open-air transit',
          textureKeys: input.preset === 'night' ? ['soft', 'nocturnal'] : ['glossy', 'kinetic'],
        },
        tideEffective: input.preset === 'night' ? 0.72 : 0.44,
        weatherCondition: condition,
        timePhase: phaseForHour(hour),
        moonPhase: input.preset === 'night' ? 'waxing_gibbous' : 'first_quarter',
      },
      bpm,
      totalDurationMs: DEMO_DURATION_SEC * 1000,
      seed: `sandbox-${input.preset}-${input.revision}`,
      dayOfWeek: DAY_OF_WEEK,
      bodyActivity,
      locationType,
    },
    locationType,
    bodyActivity,
    phraseOfTheMoment: {
      phrase: input.preset === 'night' ? 'morracium drift' : 'calcium running',
      material: input.preset === 'night' ? 'morracium' : 'calcium',
      force: input.preset === 'rain' ? 'rainfall' : bodyActivity,
      wordOrder: 'material-force',
      pools: {
        materialVersion: 'sandbox',
        forceVersion: 'sandbox',
      },
    },
  };
}

function dateForDemoHour(hour: number): Date {
  const wholeHour = Math.floor(hour);
  const minutes = Math.round((hour - wholeHour) * 60);
  return new Date(2026, 4, 15, wholeHour, minutes, 0, 0);
}

function weatherForPreset(preset: DemoDialPreset, isNight: boolean): WeatherCondition {
  if (preset === 'rain') return 'rain';
  if (isNight) return 'mainly_clear';
  return 'clear';
}

function bodyForPreset(preset: DemoDialPreset): BodyActivity {
  if (preset === 'night') return 'walking';
  return 'running';
}

function patternForActivity(activity: BodyActivity): MovementPattern {
  if (activity === 'running') return 'rhythmic';
  if (activity === 'walking') return 'steady';
  return 'still';
}

function locationTypeForPreset(preset: DemoDialPreset): LocationType {
  if (preset === 'night') return 'bar_or_pub';
  if (preset === 'rain') return 'on_foot_street';
  return 'park_urban';
}

function phaseForHour(hour: number): TimePhase {
  if (hour < 5) return 'witching_hour';
  if (hour < 7) return 'dawn';
  if (hour < 11.5) return 'morning';
  if (hour < 13.5) return 'noon';
  if (hour < 17.2) return 'afternoon';
  if (hour < 18.6) return 'golden_hour';
  if (hour < 20) return 'dusk';
  return 'night';
}

function moodForPreset(preset: DemoDialPreset): Record<string, number> {
  if (preset === 'night') {
    return {
      nocturnal: 0.9,
      inward: 0.74,
      drifting: 0.66,
      blue: 0.42,
    };
  }
  if (preset === 'rain') {
    return {
      reflective: 0.82,
      humid: 0.76,
      active: 0.68,
      glassy: 0.51,
    };
  }
  return {
    active: 0.88,
    bright: 0.74,
    open: 0.65,
    urban: 0.48,
  };
}

function normalizeHour(value: number): number {
  return ((value % 24) + 24) % 24;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
