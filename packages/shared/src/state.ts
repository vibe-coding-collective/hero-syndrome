export type TimePhase =
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'goldenHour'
  | 'dusk'
  | 'night'
  | 'witchingHour';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type WeatherCondition =
  | 'clear'
  | 'mainly-clear'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-drizzle'
  | 'rain'
  | 'freezing-rain'
  | 'snow'
  | 'snow-grains'
  | 'rain-showers'
  | 'snow-showers'
  | 'thunderstorm'
  | 'thunderstorm-hail';

export type MotionClass = 'still' | 'walking' | 'running' | 'vehicle';
export type MovementPattern = 'still' | 'steady' | 'rhythmic' | 'erratic';
export type PlaceType =
  | 'park'
  | 'urban'
  | 'residential'
  | 'coast'
  | 'water'
  | 'forest'
  | 'rural'
  | 'industrial'
  | 'transit'
  | 'unknown';

export interface StateVector {
  timestamp: string;
  time: {
    hour: number;
    phase: TimePhase;
    dayOfWeek: DayOfWeek;
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
  location?: {
    speedMps: number;
    motionClass: MotionClass;
    placeType: PlaceType;
    place?: {
      category: string;
      type: string;
      name?: string;
    };
    road?: {
      class: string;
      name?: string;
    };
    nearby?: Array<{
      category: string;
      type: string;
      name?: string;
      distanceM: number;
    }>;
    neighborhood?: string;
    city?: string;
  };
  movement: {
    intensityNormalized: number;
    pattern: MovementPattern;
  };
  cosmic?: CosmicSnapshot;
}

export interface CosmicSnapshot {
  spaceWeather?: {
    kIndex: number;
    solarWindSpeedKmS: number;
    solarWindDensity: number;
  };
  cosmicWord?: {
    word: string;
    flux: number[];
    method: 'random-projection-bge-small';
    source: 'goes-proton-differential' | 'pseudo';
    fetchedAtUtc: string;
    vocabDate: string;
    vocabSeed: string;
  };
}

export interface Sticker {
  emoji: string;
  placedAt: string;
  decayAt: string;
}
