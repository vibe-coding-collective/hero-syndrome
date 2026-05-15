import type {
  BodyActivity,
  LocationType,
  MoonPhase,
  StateVector,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';
import type { PlayedSong } from '../state/store';
import {
  computeLightLevel,
  dateToCivicHour,
  sunTimesFor,
} from './solarPosition';

export type DialOptionKind = 'location' | 'activity';

export interface DialOption {
  id: string;
  kind: DialOptionKind;
  label: string;
  value: string;
  score: number;
  source: string;
}

export interface DialViewModel {
  songId: string;
  hour: number;
  phase: TimePhase;
  phaseLabel: string;
  dayOfWeek: string;
  isNight: boolean;
  /** Lunar phase from `song.stacked.moonPhase`. Drives the moon icon at night.
   *  Falls back to 'full' when stacked metadata isn't available (preludes,
   *  malformed payloads). */
  moonPhase: MoonPhase;
  sunriseHour: number;
  sunsetHour: number;
  weatherLabel: string;
  weatherCondition: WeatherCondition;
  tempLabel: string;
  motionLabel: string;
  placeLabel: string;
  /** Fallback for the top arc button when there's no location data — the
   *  user's coords rounded to one decimal, e.g. "22.3°N 114.2°E". Empty
   *  string if coords are unavailable. */
  coordsLabel: string;
  materialLabel: string;
  forceLabel: string;
  bpm: number;
  key: string;
  moodTags: string[];
  orbColors: [string, string];
  intensityNormalized: number;
  /** Adaptive lighting (0..1): smooth function of sun altitude at the
   *  user's coords, attenuated by cloud cover. Falls back to a neutral
   *  midday value when coords aren't available. Drives the dial's overall
   *  brightness via a CSS variable. */
  lightLevel: number;
  locationOptions: DialOption[];
  activityOptions: DialOption[];
  /** Index of the option to align under the wheel pointer (always 0 — the
   *  highest-scored option for the song). Kept explicit so animation code can
   *  reason about target rotations without re-deriving. */
  selectedLocationIndex: 0;
  selectedActivityIndex: 0;
}

const MAX_OPTIONS = 8;

const LOCATION_TYPE_LABELS: Partial<Record<LocationType, string>> = {
  home_interior: 'HOME',
  home_garden: 'GARDEN',
  office: 'OFFICE',
  co_working_space: 'COWORK',
  factory_or_warehouse: 'WAREHOUSE',
  construction_site: 'SITE',
  cafe: 'CAFE',
  retail_shop: 'SHOP',
  shopping_mall: 'MALL',
  supermarket: 'MARKET',
  outdoor_market: 'MARKET',
  restaurant: 'RESTAURANT',
  bar_or_pub: 'BAR',
  nightclub: 'CLUB',
  fast_food: 'FAST FOOD',
  food_truck_or_street_food: 'STREET FOOD',
  train_station: 'STATION',
  bus_station: 'BUS',
  airport: 'AIRPORT',
  subway_or_metro: 'METRO',
  tunnel_or_underpass: 'TUNNEL',
  highway_or_motorway: 'HIGHWAY',
  parking_lot_or_garage: 'PARKING',
  park_urban: 'PARK',
  plaza_or_public_square: 'PLAZA',
  rooftop: 'ROOFTOP',
  alleyway_or_back_street: 'ALLEY',
  park_large_natural: 'NATURE',
  forest_or_woods: 'FOREST',
  mountain_or_hills: 'MOUNTAIN',
  beach_or_coast: 'COAST',
  river_or_lake: 'WATER',
  ocean_or_open_water: 'OCEAN',
  desert_or_arid_land: 'DESERT',
  field_or_meadow: 'FIELD',
  cave_or_underground: 'CAVE',
  museum_or_gallery: 'GALLERY',
  library: 'LIBRARY',
  theatre_or_cinema: 'THEATRE',
  concert_venue: 'VENUE',
  stadium_or_arena: 'ARENA',
  gym_or_fitness: 'GYM',
  school_or_university: 'SCHOOL',
  hospital_or_clinic: 'CLINIC',
  government_building: 'CIVIC',
  place_of_worship: 'TEMPLE',
  historic_site: 'HISTORIC',
  rural_settlement: 'RURAL',
  wilderness_or_remote: 'REMOTE',
  on_foot_street: 'STREET',
  unknown: 'UNKNOWN',
};

const PHASE_LABELS: Record<TimePhase, string> = {
  witching_hour: 'WITCHING HOUR',
  dawn: 'FIRST LIGHT',
  morning: 'MORNING HAZE',
  noon: 'HIGH NOON',
  afternoon: 'LONG SHADOWS',
  golden_hour: 'GOLDEN HOUR',
  dusk: 'DUSK',
  night: 'DEEP NIGHT',
};

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: 'CLEAR',
  mainly_clear: 'MAINLY CLEAR',
  overcast: 'OVERCAST',
  fog: 'FOG',
  drizzle: 'DRIZZLE',
  freezing_drizzle: 'FREEZING DRIZZLE',
  rain: 'RAIN',
  freezing_rain: 'FREEZING RAIN',
  snow: 'SNOW',
  snow_grains: 'SNOW GRAINS',
  rain_showers: 'RAIN SHOWERS',
  snow_showers: 'SNOW SHOWERS',
  thunderstorm: 'THUNDERSTORM',
  thunderstorm_hail: 'HAIL STORM',
};

const BODY_LABELS: Record<BodyActivity, string> = {
  still: 'STILL',
  walking: 'WALKING',
  running: 'RUNNING',
  vehicle: 'VEHICLE',
};

/** Build the dial view model from a generated song record. Returns `null` for
 *  songs that don't carry the server-derived fields (preludes) so the caller
 *  can render the waiting state. */
export function buildDialViewModelFromSong(song: PlayedSong): DialViewModel | null {
  if (!song.stateVector || !song.stacked || !song.renderPlan || !song.locationType) {
    return null;
  }
  const state = song.stateVector;
  const hour = state.time.hour;
  const phase = state.time.phase;
  const weather = state.weather;
  const weatherCondition = weather?.condition ?? 'mainly_clear';
  const coords = state.location?.coords;
  const songDate = new Date(state.timestamp);
  // Prefer astronomical sunrise/sunset from the user's coords + date over
  // the weather provider's proximity values (which use UTC days and can be
  // off by one across the dateline). Fall back to proximity if coords are
  // missing, then to a neutral 06/18.
  const sun = coords ? sunTimesFor(songDate, coords.lat, coords.lon) : null;
  const sunriseHour = sun
    ? dateToCivicHour(sun.sunrise)
    : weather
      ? estimateSunHourFromProximity(hour, weather.sunriseProximityMin)
      : 6;
  const sunsetHour = sun
    ? dateToCivicHour(sun.sunset)
    : weather
      ? estimateSunHourFromProximity(hour, weather.sunsetProximityMin)
      : 18;
  const isNight = weather ? !weather.isDay : hour < sunriseHour || hour >= sunsetHour;
  const intensityNormalized = state.movement.intensityNormalized;
  const moodTags = topMoodTags(song.stacked.mood);
  const lightLevel = computeLightLevel({
    date: songDate,
    lat: coords?.lat,
    lon: coords?.lon,
    cloudCoverPct: weather?.cloudCoverPct,
  });

  return {
    songId: song.songId,
    hour,
    phase,
    phaseLabel: PHASE_LABELS[phase],
    dayOfWeek: state.time.dayOfWeek.toUpperCase(),
    isNight,
    moonPhase: song.stacked.moonPhase,
    sunriseHour,
    sunsetHour,
    // Empty strings rather than placeholder text when data is missing — the
    // component joins readout lines with `filter(Boolean).join(' / ')` so
    // missing parts disappear instead of rendering as "UNKNOWN" / "NO
    // WEATHER" / "MAINLY CLEAR" (the latter would be a lie).
    weatherLabel: weather ? WEATHER_LABELS[weather.condition] : '',
    weatherCondition,
    tempLabel: weather ? `${Math.round(weather.tempC)}C / ${Math.round(weather.humidityPct)}%` : '',
    motionLabel: buildMotionLabel(state, song.bodyActivity ?? 'still'),
    placeLabel: buildPlaceLabel(state, song.locationType),
    coordsLabel: coords ? formatCoords(coords.lat, coords.lon) : '',
    materialLabel: (song.phraseOfTheMoment?.material ?? '').toUpperCase(),
    forceLabel: (song.phraseOfTheMoment?.force ?? '').toUpperCase(),
    bpm: song.renderPlan.bpm,
    key: song.metadata.key,
    moodTags,
    orbColors: colorsForWeather(weatherCondition, isNight, intensityNormalized),
    intensityNormalized,
    lightLevel,
    locationOptions: collectLocationOptions(song, moodTags),
    activityOptions: collectActivityOptions(song, moodTags),
    selectedLocationIndex: 0,
    selectedActivityIndex: 0,
  };
}

function estimateSunHourFromProximity(currentHour: number, proximityMin: number): number {
  return normalizeHourFloat(currentHour - proximityMin / 60);
}

function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}

function topMoodTags(mood: Record<string, number>, count = 6, threshold = 0.08): string[] {
  return Object.entries(mood)
    .filter(([, value]) => value > threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([tag]) => tag);
}

function collectLocationOptions(song: PlayedSong, _moodTags: string[]): DialOption[] {
  const state = song.stateVector!;
  const locationType = song.locationType!;
  const location = state.location;
  const options: DialOption[] = [];

  // Skip the classified-location-type option when it's just "unknown" — better
  // to leave the slot empty than to label the user's place as UNKNOWN.
  if (locationType !== 'unknown') {
    addOption(options, {
      id: `location-type:${locationType}`,
      kind: 'location',
      label: LOCATION_TYPE_LABELS[locationType] ?? displayToken(locationType),
      value: locationType,
      source: 'classified-location-type',
      score: 110,
    });
  }

  if (location?.place) {
    addOption(options, {
      id: `place:${location.place.category}:${location.place.type}:${location.place.name ?? 'unnamed'}`,
      kind: 'location',
      label: compactLabel(location.place.name ?? location.place.type),
      value: location.place.name ?? location.place.type,
      source: 'reverse-geocode-place',
      score: 104,
    });
  }

  if (location?.neighborhood) {
    addOption(options, {
      id: `neighborhood:${location.neighborhood}`,
      kind: 'location',
      label: compactLabel(location.neighborhood),
      value: location.neighborhood,
      source: 'reverse-geocode-neighborhood',
      score: 86,
    });
  }

  if (location?.city) {
    addOption(options, {
      id: `city:${location.city}`,
      kind: 'location',
      label: compactLabel(location.city),
      value: location.city,
      source: 'reverse-geocode-city',
      score: 78,
    });
  }

  for (const poi of location?.nearby ?? []) {
    const label = compactLabel(poi.name ?? poi.type);
    const namedBoost = poi.name ? 12 : 0;
    const distancePenalty = Math.min(30, poi.distanceM / 12);
    addOption(options, {
      id: `nearby:${poi.category}:${poi.type}:${poi.name ?? poi.distanceM}`,
      kind: 'location',
      label,
      value: poi.name ?? poi.type,
      source: `nearby-${poi.category}`,
      score: 78 + namedBoost - distancePenalty,
    });
  }

  return options.sort((a, b) => b.score - a.score).slice(0, MAX_OPTIONS);
}

function collectActivityOptions(song: PlayedSong, moodTags: string[]): DialOption[] {
  const state = song.stateVector!;
  const options: DialOption[] = [];
  const bodyActivity = song.bodyActivity ?? state.location?.bodyActivity ?? 'still';
  const intensity = state.movement.intensityNormalized;

  addOption(options, {
    id: `body:${bodyActivity}`,
    kind: 'activity',
    label: BODY_LABELS[bodyActivity],
    value: bodyActivity,
    source: 'device-motion-body',
    score: 110,
  });

  addOption(options, {
    id: `pattern:${state.movement.pattern}`,
    kind: 'activity',
    label: displayToken(state.movement.pattern),
    value: state.movement.pattern,
    source: 'device-motion-pattern',
    score: 96,
  });

  addOption(options, {
    id: `intensity:${intensityBucket(intensity)}`,
    kind: 'activity',
    label: intensityBucket(intensity),
    value: intensity.toFixed(2),
    source: 'device-motion-intensity',
    score: 90,
  });

  if (state.weather) {
    addOption(options, {
      id: `weather:${state.weather.condition}`,
      kind: 'activity',
      label: WEATHER_LABELS[state.weather.condition],
      value: state.weather.condition,
      source: 'weather-condition',
      score: 82,
    });
  }

  addOption(options, {
    id: `phase:${state.time.phase}`,
    kind: 'activity',
    label: displayToken(state.time.phase),
    value: state.time.phase,
    source: 'clock-phase',
    score: 76,
  });

  for (const tag of moodTags) {
    addOption(options, {
      id: `mood:${tag}`,
      kind: 'activity',
      label: displayToken(tag),
      value: tag,
      source: 'stacked-mood',
      score: 70,
    });
  }

  return options.sort((a, b) => b.score - a.score).slice(0, MAX_OPTIONS);
}

function addOption(options: DialOption[], option: DialOption): void {
  const normalized = option.label.toUpperCase();
  if (options.some((item) => item.label.toUpperCase() === normalized)) return;
  options.push({ ...option, label: normalized });
}

function compactLabel(value: string): string {
  const cleaned = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleaned.split(' ');
  if (words.length > 2) return words.slice(0, 2).join(' ').toUpperCase();
  return cleaned.toUpperCase();
}

function displayToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toUpperCase();
}

function intensityBucket(value: number): string {
  if (value < 0.25) return 'LOW MOTION';
  if (value < 0.55) return 'ACTIVE';
  if (value < 0.8) return 'HIGH ENERGY';
  return 'PEAK ENERGY';
}

function buildMotionLabel(state: StateVector, body: BodyActivity): string {
  const speed = state.location ? ` ${Math.round(state.location.speedMps * 3.6)}KMH` : '';
  return `${BODY_LABELS[body]} / ${displayToken(state.movement.pattern)}${speed}`;
}

function buildPlaceLabel(state: StateVector, locationType: LocationType): string {
  const primary = state.location?.place?.name ?? state.location?.neighborhood ?? state.location?.city;
  if (primary) return compactLabel(primary);
  if (locationType === 'unknown') return '';
  return LOCATION_TYPE_LABELS[locationType] ?? '';
}

function normalizeHourFloat(value: number): number {
  return ((value % 24) + 24) % 24;
}

function colorsForWeather(
  condition: WeatherCondition,
  isNight: boolean,
  intensity: number,
): [string, string] {
  if (isNight) {
    if (condition.includes('rain') || condition === 'drizzle') return ['#b7ccff', '#5f7ea8'];
    return ['#cadcfc', '#7783c4'];
  }
  if (condition.includes('rain') || condition === 'drizzle') return ['#d8f0ff', '#7ca5b5'];
  if (condition.includes('snow')) return ['#f7fbff', '#b9d9e8'];
  if (condition === 'clear' || condition === 'mainly_clear') return ['#fff1b8', intensity > 0.6 ? '#f29e4c' : '#9fc9ff'];
  return ['#e8edf2', '#a4b4bf'];
}
