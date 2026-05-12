import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MoonPhase,
  MovementPattern,
  StateVector,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';

export type DialTimePhase = TimePhase;
export type DialDayOfWeek = DayOfWeek;
export type DialWeatherCondition = WeatherCondition;
export type DialBodyActivity = BodyActivity;
export type DialMovementPattern = MovementPattern;
export type DialMoonPhase = MoonPhase;
export type DialLocationType = LocationType;
export type DialStateVector = StateVector;

export interface DialDerivedOutput {
  locationType: DialLocationType;
  moonPhase: DialMoonPhase;
  phraseOfTheMoment: {
    phrase: string;
    material: string;
    force: string;
  };
  renderPlan: {
    bpm: number;
    key: string;
    totalDurationMs: number;
  };
  stacked: {
    energy: {
      motion: number;
      density: number;
      tension: number;
      brightness: number;
    };
    moodTags: string[];
    world: string;
    textureKeys: string[];
  };
}

export interface DialDemoSnapshot {
  id: string;
  label: string;
  stateVector: DialStateVector;
  derived: DialDerivedOutput;
}

export const dialDemoSnapshots: DialDemoSnapshot[] = [
  {
    id: 'rainy-office-witching',
    label: 'Rainy office, running, witching hour',
    stateVector: {
      timestamp: '2026-05-12T03:08:00+08:00',
      time: {
        hour: 3,
        phase: 'witching_hour',
        dayOfWeek: 'Tuesday',
      },
      weather: {
        tempC: 24,
        feelsLikeC: 27,
        humidityPct: 88,
        condition: 'rain',
        precipitationMmHr: 2.2,
        cloudCoverPct: 92,
        windMps: 4.6,
        isDay: false,
        sunriseProximityMin: -174,
        sunsetProximityMin: 548,
      },
      location: {
        speedMps: 3.1,
        bodyActivity: 'running',
        place: {
          category: 'office',
          type: 'company',
          name: 'VCC Studio',
        },
        road: {
          class: 'tertiary',
          name: 'Electric Road',
        },
        nearby: [
          { category: 'office', type: 'company', name: 'VCC Studio', distanceM: 8 },
          { category: 'amenity', type: 'cafe', name: 'Afterglow Coffee', distanceM: 42 },
          { category: 'shop', type: 'convenience', name: 'Night Market Store', distanceM: 64 },
          { category: 'amenity', type: 'restaurant', name: 'Morrison Kitchen', distanceM: 83 },
          { category: 'leisure', type: 'fitness_centre', name: 'Harbour Run Club', distanceM: 96 },
          { category: 'tourism', type: 'gallery', name: 'Calcium Room', distanceM: 118 },
          { category: 'amenity', type: 'school', name: 'North Point Music School', distanceM: 152 },
          { category: 'railway', type: 'station', name: 'Fortress Hill', distanceM: 211 },
          { category: 'leisure', type: 'park', name: 'Tin Hau Temple Garden', distanceM: 286 },
          { category: 'shop', type: 'mall', name: 'Island Place', distanceM: 344 },
        ],
        neighborhood: 'North Point',
        city: 'Hong Kong',
        state: 'Hong Kong',
        country: 'Hong Kong',
        countryCode: 'HK',
        postcode: '999077',
      },
      movement: {
        intensityNormalized: 0.78,
        pattern: 'rhythmic',
      },
      cosmic: {
        spaceWeather: {
          kIndex: 3,
          solarWindSpeedKmS: 416,
          solarWindDensity: 6.4,
        },
      },
    },
    derived: {
      locationType: 'office',
      moonPhase: 'waning_crescent',
      phraseOfTheMoment: {
        phrase: 'morracium calcium',
        material: 'calcium',
        force: 'morracium',
      },
      renderPlan: {
        bpm: 134,
        key: 'D minor',
        totalDurationMs: 60_000,
      },
      stacked: {
        energy: {
          motion: 0.72,
          density: 0.64,
          tension: 0.66,
          brightness: 0.18,
        },
        moodTags: ['uncanny', 'focused', 'wet', 'rhythmic', 'mechanical', 'intimate'],
        world: 'deep_nocturnal',
        textureKeys: ['sub_bass_drone', 'slow_unstable_noise_bed', 'granular_rain_bed'],
      },
    },
  },
];
