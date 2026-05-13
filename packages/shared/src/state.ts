export type TimePhase =
  | 'witching_hour'
  | 'dawn'
  | 'morning'
  | 'noon'
  | 'afternoon'
  | 'golden_hour'
  | 'dusk'
  | 'night';

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export type WeatherCondition =
  | 'clear'
  | 'mainly_clear'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing_drizzle'
  | 'rain'
  | 'freezing_rain'
  | 'snow'
  | 'snow_grains'
  | 'rain_showers'
  | 'snow_showers'
  | 'thunderstorm'
  | 'thunderstorm_hail';

export type MoonPhase =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'third_quarter'
  | 'waning_crescent';

export type BodyActivity = 'still' | 'walking' | 'running' | 'vehicle';

/** Sensor-collected body motion pattern. Still collected; NOT consumed by the
 *  music engine — kept on StateVector for future use. */
export type MovementPattern = 'still' | 'steady' | 'rhythmic' | 'erratic';

/** Coarse 50+1 location taxonomy. The classification step (a Claude Haiku
 *  call) picks one of these per song from rich reverse-geocode data. The
 *  `unknown` value is an internal fallback for classification failures. */
export type LocationType =
  | 'home_interior'
  | 'home_garden'
  | 'office'
  | 'co_working_space'
  | 'factory_or_warehouse'
  | 'construction_site'
  | 'retail_shop'
  | 'shopping_mall'
  | 'supermarket'
  | 'outdoor_market'
  | 'cafe'
  | 'restaurant'
  | 'bar_or_pub'
  | 'nightclub'
  | 'fast_food'
  | 'food_truck_or_street_food'
  | 'train_station'
  | 'bus_station'
  | 'airport'
  | 'subway_or_metro'
  | 'tunnel_or_underpass'
  | 'on_foot_street'
  | 'highway_or_motorway'
  | 'parking_lot_or_garage'
  | 'park_urban'
  | 'plaza_or_public_square'
  | 'rooftop'
  | 'alleyway_or_back_street'
  | 'park_large_natural'
  | 'forest_or_woods'
  | 'mountain_or_hills'
  | 'beach_or_coast'
  | 'river_or_lake'
  | 'ocean_or_open_water'
  | 'desert_or_arid_land'
  | 'field_or_meadow'
  | 'cave_or_underground'
  | 'museum_or_gallery'
  | 'library'
  | 'theatre_or_cinema'
  | 'concert_venue'
  | 'stadium_or_arena'
  | 'gym_or_fitness'
  | 'school_or_university'
  | 'hospital_or_clinic'
  | 'government_building'
  | 'place_of_worship'
  | 'historic_site'
  | 'rural_settlement'
  | 'wilderness_or_remote'
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
    bodyActivity: BodyActivity;
    /** Raw lat/lon from the geolocation sensor. Surfaced on the StateVector
     *  (and via /generate back to the client) so the dial can compute sun
     *  position locally — astronomical sunrise/sunset, elevation, and the
     *  adaptive lightLevel — without round-tripping through the weather API. */
    coords?: {
      lat: number;
      lon: number;
    };
    /** Raw reverse-geocode fields fed into the Claude location-classification
     *  step. The classified `locationType` lives on the song record, not here. */
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
    state?: string;
    country?: string;
    countryCode?: string;
    postcode?: string;
  };
  /** Body movement signals. Currently collected by the sensor pipeline but NOT
   *  passed through to the music engine — kept here for future hookup. */
  movement: {
    intensityNormalized: number;
    pattern: MovementPattern;
  };
  cosmic?: CosmicSnapshot;
}

/** Per-session cosmic snapshot. `cosmicWord` field is unused by the music
 *  engine (word-of-the-moment dropped), but kept for the legacy daily-rotated
 *  vocabulary worker maintains it; can be cleaned up later. */
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
