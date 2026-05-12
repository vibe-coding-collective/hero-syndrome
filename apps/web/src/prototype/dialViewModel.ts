import type {
  DialBodyActivity,
  DialDemoSnapshot,
  DialLocationType,
  DialStateVector,
  DialTimePhase,
  DialWeatherCondition,
} from '../data/dynamicDialDemo';

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
  snapshotId: string;
  hour: number;
  phase: DialTimePhase;
  phaseLabel: string;
  dayOfWeek: string;
  isNight: boolean;
  sunriseHour: number;
  sunsetHour: number;
  weatherLabel: string;
  weatherCondition: DialWeatherCondition;
  tempLabel: string;
  motionLabel: string;
  placeLabel: string;
  materialLabel: string;
  forceLabel: string;
  bpm: number;
  key: string;
  moodTags: string[];
  orbColors: [string, string];
  locationOptions: DialOption[];
  activityOptions: DialOption[];
  raw: DialDemoSnapshot;
}

export interface CompositionReadyPackage {
  version: 'dial-composition-package.v1';
  snapshotId: string;
  capturedAt: string;
  generation: {
    musicEnabled: boolean;
    target: 'disabled_prototype' | 'worker_generate';
  };
  selected: {
    hour: number;
    phase: DialTimePhase;
    weatherCondition: DialWeatherCondition;
    location: DialOption;
    activity: DialOption;
  };
  state: {
    time: DialStateVector['time'];
    weather?: DialStateVector['weather'];
    location?: DialStateVector['location'];
    movement: DialStateVector['movement'];
    cosmic?: DialStateVector['cosmic'];
  };
  music: {
    bpm: number;
    key: string;
    totalDurationMs: number;
    material: string;
    force: string;
    phraseOfTheMoment: string;
    locationType: DialLocationType;
    moodTags: string[];
    energy: DialDemoSnapshot['derived']['stacked']['energy'];
  };
  candidates: {
    locations: DialOption[];
    activities: DialOption[];
  };
}

const MAX_OPTIONS = 8;

const LOCATION_TYPE_LABELS: Partial<Record<DialLocationType, string>> = {
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

const WEATHER_LABELS: Record<DialWeatherCondition, string> = {
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

const BODY_LABELS: Record<DialBodyActivity, string> = {
  still: 'STILL',
  walking: 'WALKING',
  running: 'RUNNING',
  vehicle: 'VEHICLE',
};

export function phaseFromHour(hour: number): DialTimePhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 13) return 'noon';
  if (hour >= 13 && hour < 16) return 'afternoon';
  if (hour >= 16 && hour < 19) return 'golden_hour';
  if (hour >= 19 && hour < 21) return 'dusk';
  if (hour >= 21 || hour < 2) return 'night';
  return 'witching_hour';
}

export function buildDialViewModel(snapshot: DialDemoSnapshot, hourOverride?: number): DialViewModel {
  const hour = hourOverride ?? snapshot.stateVector.time.hour;
  const phase = phaseFromHour(hour);
  const weather = snapshot.stateVector.weather;
  const weatherCondition = weather?.condition ?? 'mainly_clear';
  const { sunriseHour, sunsetHour } = estimateSunHours(snapshot.stateVector);
  const isNight = hour < sunriseHour || hour >= sunsetHour;

  return {
    snapshotId: snapshot.id,
    hour,
    phase,
    phaseLabel: displayToken(phase),
    dayOfWeek: snapshot.stateVector.time.dayOfWeek.toUpperCase(),
    isNight,
    sunriseHour,
    sunsetHour,
    weatherLabel: WEATHER_LABELS[weatherCondition],
    weatherCondition,
    tempLabel: weather ? `${Math.round(weather.tempC)}C / ${Math.round(weather.humidityPct)}%` : 'NO WEATHER',
    motionLabel: buildMotionLabel(snapshot.stateVector),
    placeLabel: buildPlaceLabel(snapshot.stateVector, snapshot.derived.locationType),
    materialLabel: snapshot.derived.phraseOfTheMoment.material.toUpperCase(),
    forceLabel: snapshot.derived.phraseOfTheMoment.force.toUpperCase(),
    bpm: snapshot.derived.renderPlan.bpm,
    key: snapshot.derived.renderPlan.key,
    moodTags: snapshot.derived.stacked.moodTags,
    orbColors: colorsForWeather(weatherCondition, isNight, snapshot.stateVector.movement.intensityNormalized),
    locationOptions: collectLocationOptions(snapshot),
    activityOptions: collectActivityOptions(snapshot, phase),
    raw: snapshot,
  };
}

export function buildCompositionReadyPackage(
  model: DialViewModel,
  selectedLocation: DialOption,
  selectedActivity: DialOption,
  options: { musicEnabled?: boolean } = {},
): CompositionReadyPackage {
  const state = model.raw.stateVector;
  const musicEnabled = options.musicEnabled === true;
  return {
    version: 'dial-composition-package.v1',
    snapshotId: model.snapshotId,
    capturedAt: state.timestamp,
    generation: {
      musicEnabled,
      target: musicEnabled ? 'worker_generate' : 'disabled_prototype',
    },
    selected: {
      hour: model.hour,
      phase: model.phase,
      weatherCondition: model.weatherCondition,
      location: selectedLocation,
      activity: selectedActivity,
    },
    state: {
      time: { ...state.time, hour: model.hour, phase: model.phase },
      ...(state.weather ? { weather: state.weather } : {}),
      ...(state.location ? { location: state.location } : {}),
      movement: state.movement,
      ...(state.cosmic ? { cosmic: state.cosmic } : {}),
    },
    music: {
      bpm: model.raw.derived.renderPlan.bpm,
      key: model.raw.derived.renderPlan.key,
      totalDurationMs: model.raw.derived.renderPlan.totalDurationMs,
      material: model.raw.derived.phraseOfTheMoment.material,
      force: model.raw.derived.phraseOfTheMoment.force,
      phraseOfTheMoment: model.raw.derived.phraseOfTheMoment.phrase,
      locationType: model.raw.derived.locationType,
      moodTags: model.raw.derived.stacked.moodTags,
      energy: model.raw.derived.stacked.energy,
    },
    candidates: {
      locations: model.locationOptions,
      activities: model.activityOptions,
    },
  };
}

function collectLocationOptions(snapshot: DialDemoSnapshot): DialOption[] {
  const state = snapshot.stateVector;
  const location = state.location;
  const options: DialOption[] = [];

  addOption(options, {
    id: `location-type:${snapshot.derived.locationType}`,
    kind: 'location',
    label: LOCATION_TYPE_LABELS[snapshot.derived.locationType] ?? displayToken(snapshot.derived.locationType),
    value: snapshot.derived.locationType,
    source: 'classified-location-type',
    score: 110,
  });

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

  return options
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPTIONS);
}

function collectActivityOptions(snapshot: DialDemoSnapshot, phase: DialTimePhase): DialOption[] {
  const state = snapshot.stateVector;
  const options: DialOption[] = [];
  const bodyActivity = state.location?.bodyActivity ?? 'still';
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
    id: `phase:${phase}`,
    kind: 'activity',
    label: displayToken(phase),
    value: phase,
    source: 'clock-phase',
    score: 76,
  });

  for (const tag of snapshot.derived.stacked.moodTags) {
    addOption(options, {
      id: `mood:${tag}`,
      kind: 'activity',
      label: displayToken(tag),
      value: tag,
      source: 'stacked-mood',
      score: 70,
    });
  }

  return options
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPTIONS);
}

function addOption(options: DialOption[], option: DialOption): void {
  const normalized = option.label.toUpperCase();
  if (options.some((item) => item.label.toUpperCase() === normalized)) return;
  options.push({ ...option, label: normalized });
}

function compactLabel(value: string): string {
  const cleaned = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function buildMotionLabel(state: DialStateVector): string {
  const body = state.location?.bodyActivity ?? 'still';
  const speed = state.location ? ` ${Math.round(state.location.speedMps * 3.6)}KMH` : '';
  return `${BODY_LABELS[body]} / ${displayToken(state.movement.pattern)}${speed}`;
}

function buildPlaceLabel(state: DialStateVector, locationType: DialLocationType): string {
  const primary = state.location?.place?.name ?? state.location?.neighborhood ?? state.location?.city;
  return compactLabel(primary ?? LOCATION_TYPE_LABELS[locationType] ?? locationType);
}

function estimateSunHours(state: DialStateVector): { sunriseHour: number; sunsetHour: number } {
  const weather = state.weather;
  if (!weather) return { sunriseHour: 6, sunsetHour: 18 };
  const baseHour = state.time.hour;
  const sunriseHour = normalizeHourFloat(baseHour - weather.sunriseProximityMin / 60);
  const sunsetHour = normalizeHourFloat(baseHour - weather.sunsetProximityMin / 60);
  return { sunriseHour, sunsetHour };
}

function normalizeHourFloat(value: number): number {
  return ((value % 24) + 24) % 24;
}

function colorsForWeather(
  condition: DialWeatherCondition,
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
