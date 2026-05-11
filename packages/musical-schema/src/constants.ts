import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  MoonPhase,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';
import type { EnergyAxes, MoodWeights } from './types';

export const TIME_MOOD_SENSITIVITY: Record<TimePhase, number> = {
  witching_hour: 1.2,
  dawn: 1.1,
  morning: 0.85,
  noon: 0.75,
  afternoon: 0.8,
  golden_hour: 1.0,
  dusk: 1.15,
  night: 1.1,
};

export const WEATHER_MOOD_SENSITIVITY: Record<TimePhase, number> = {
  witching_hour: 1.25,
  dawn: 1.1,
  morning: 0.85,
  noon: 0.7,
  afternoon: 0.8,
  golden_hour: 1.0,
  dusk: 1.2,
  night: 1.15,
};

export const LUNAR_SENS_BY_PHASE: Record<TimePhase, number> = {
  witching_hour: 1.2,
  night: 1.15,
  dusk: 1.08,
  dawn: 1.05,
  golden_hour: 0.95,
  afternoon: 0.8,
  morning: 0.85,
  noon: 0.75,
};

/** Per-phase location sensitivity. Flat 1.0 for v1 — location is location.
 *  Tune per phase if e.g. nightclub at noon feels weaker than at midnight. */
export const LOCATION_MOOD_SENSITIVITY: Record<TimePhase, number> = {
  witching_hour: 1.0,
  dawn: 1.0,
  morning: 1.0,
  noon: 1.0,
  afternoon: 1.0,
  golden_hour: 1.0,
  dusk: 1.0,
  night: 1.0,
};

export const TIDE_RANGE_MULT: Record<MoonPhase, number> = {
  new: 1.12,
  waxing_crescent: 1.02,
  first_quarter: 0.88,
  waxing_gibbous: 1.06,
  full: 1.12,
  waning_gibbous: 1.06,
  third_quarter: 0.88,
  waning_crescent: 1.02,
};

export const MOON_UNDERTOW_TARGETS: Record<MoonPhase, MoodWeights> = {
  new: { tentative: 0.08, unresolved: 0.07, sparse: 0.06 },
  waxing_crescent: { gathering: 0.06, sharpening: 0.04, purposeful: 0.04 },
  first_quarter: { steady: 0.05, neutral: 0.05, pragmatic: 0.04 },
  waxing_gibbous: { building: 0.06, luminous: 0.05, accumulating: 0.05 },
  full: { exposed: 0.07, charged: 0.06, luminous: 0.05 },
  waning_gibbous: { recounting: 0.06, simplifying: 0.04, distancing: 0.04 },
  third_quarter: { critical: 0.04, even: 0.05, released: 0.03 },
  waning_crescent: { emptied: 0.06, devotional: 0.04, drifting: 0.06 },
};

export const DAY_ENERGY_DELTA: Record<DayOfWeek, number> = {
  Monday: -0.04,
  Tuesday: -0.02,
  Wednesday: -0.08,
  Thursday: 0,
  Friday: 0.05,
  Saturday: 0.1,
  Sunday: -0.01,
};

export const DAY_MOOD_DELTA: Record<DayOfWeek, MoodWeights> = {
  Monday: { focused: 0.04, serious: 0.03, playful: -0.03 },
  Tuesday: { steady: 0.03, practical: 0.03, dreamlike: -0.02 },
  Wednesday: {
    introspective: 0.07,
    fatigued: 0.06,
    flat: 0.05,
    social: -0.05,
    playful: -0.05,
  },
  Thursday: {},
  Friday: { anticipatory: 0.05, social: 0.04, expansive: 0.03 },
  Saturday: { social: 0.08, playful: 0.08, expansive: 0.06, fatigued: -0.03 },
  Sunday: { reflective: 0.06, tender: 0.04, slow: 0.03, urgent: -0.03 },
};

export const WEATHER_MOOD_DELTA: Record<WeatherCondition, MoodWeights> = {
  clear: { clear: 0.06, open: 0.05, uncertain: -0.03 },
  mainly_clear: { calm: 0.04, grounded: 0.03 },
  overcast: { reflective: 0.05, somber: 0.04, playful: -0.03 },
  fog: { uncanny: 0.07, intimate: 0.05, clarity: -0.06 },
  drizzle: { melancholic: 0.06, soft_focus: 0.05, urgent: -0.03 },
  rain: { reflective: 0.07, distant: 0.05, social: -0.04 },
  rain_showers: { restless: 0.05, uncertain: 0.05, steady: -0.03 },
  thunderstorm: { tense: 0.1, awe: 0.06, fragile: 0.03 },
  thunderstorm_hail: { threat: 0.11, chaotic: 0.08, warm: -0.04 },
  snow: { hushed: 0.08, tender: 0.05, tempo_drive: -0.04 },
  snow_grains: { brittle: 0.06, dry_cold: 0.05 },
  snow_showers: { volatile: 0.06, reflective: 0.04 },
  freezing_drizzle: { stark: 0.07, isolated: 0.05 },
  freezing_rain: { anxious: 0.08, tense: 0.07, social: -0.04 },
};

export const WEATHER_WORLD_TARGETS: Record<WeatherCondition, string[]> = {
  clear: ['daylight_chamber', 'pastoral_awakening'],
  mainly_clear: ['daylight_chamber', 'pastoral_awakening'],
  overcast: ['urban_dreamlike', 'nocturnal_ritual'],
  fog: ['urban_dreamlike', 'nocturnal_ritual'],
  drizzle: ['deep_nocturnal', 'mechanical_flow'],
  rain: ['deep_nocturnal', 'mechanical_flow'],
  rain_showers: ['deep_nocturnal', 'mechanical_flow'],
  thunderstorm: ['mechanical_flow', 'cinematic_warmth'],
  thunderstorm_hail: ['mechanical_flow', 'cinematic_warmth'],
  snow: ['pastoral_awakening', 'nocturnal_ritual'],
  snow_grains: ['pastoral_awakening', 'nocturnal_ritual'],
  snow_showers: ['pastoral_awakening', 'nocturnal_ritual'],
  freezing_drizzle: ['deep_nocturnal'],
  freezing_rain: ['deep_nocturnal'],
};

export const PHASE_TEXTURE_KEYS: Record<TimePhase, string[]> = {
  witching_hour: [
    'sub_bass_drone',
    'distant_metallic_shimmer',
    'slow_unstable_noise_bed',
  ],
  dawn: ['airy_pad', 'filtered_birdsong_motion', 'thin_harmonic_overtones'],
  morning: ['soft_pulse', 'clean_plucks', 'light_percussive_transients'],
  noon: ['clear_harmonic_bed', 'midrange_forward_ensemble', 'reduced_noise_floor'],
  afternoon: ['repeating_ostinati', 'clocklike_micro_rhythm', 'tight_room_ambience'],
  golden_hour: ['long_envelope_swells', 'gentle_tape_saturation', 'high_end_glow'],
  dusk: ['blurred_piano', 'grainy_pulse', 'wide_dark_reverb_tails'],
  night: ['subtle_rhythmic_ghosts', 'degraded_atmosphere', 'slow_harmonic_drift'],
};

export const PHASE_WORLD: Record<TimePhase, string> = {
  witching_hour: 'nocturnal_ritual',
  dawn: 'pastoral_awakening',
  morning: 'urban_kinetic_light',
  noon: 'daylight_chamber',
  afternoon: 'mechanical_flow',
  golden_hour: 'cinematic_warmth',
  dusk: 'urban_dreamlike',
  night: 'deep_nocturnal',
};

export const PHASE_ENERGY_MOOD_INSPIRATION: Record<
  TimePhase,
  { energy: EnergyAxes; mood: MoodWeights }
> = {
  witching_hour: {
    energy: { motion: 0.18, density: 0.22, tension: 0.58, brightness: 0.12 },
    mood: { uncanny: 0.55, intimate: 0.4, melancholic: 0.35, suspended: 0.3 },
  },
  dawn: {
    energy: { motion: 0.28, density: 0.3, tension: 0.4, brightness: 0.32 },
    mood: { fragile: 0.52, hopeful: 0.34, reflective: 0.3, soft_focus: 0.26 },
  },
  morning: {
    energy: { motion: 0.46, density: 0.42, tension: 0.3, brightness: 0.52 },
    mood: { clear: 0.45, purposeful: 0.42, social: 0.3, grounded: 0.28 },
  },
  noon: {
    energy: { motion: 0.56, density: 0.52, tension: 0.24, brightness: 0.64 },
    mood: { open: 0.48, direct: 0.4, warm: 0.34, extroverted: 0.28 },
  },
  afternoon: {
    energy: { motion: 0.5, density: 0.48, tension: 0.28, brightness: 0.5 },
    mood: { steady: 0.46, practical: 0.4, focused: 0.36, neutral: 0.3 },
  },
  golden_hour: {
    energy: { motion: 0.44, density: 0.4, tension: 0.32, brightness: 0.58 },
    mood: { nostalgic: 0.52, luminous: 0.46, tender: 0.34, expansive: 0.3 },
  },
  dusk: {
    energy: { motion: 0.34, density: 0.36, tension: 0.46, brightness: 0.28 },
    mood: { reflective: 0.5, uncertain: 0.42, intimate: 0.38, drifting: 0.3 },
  },
  night: {
    energy: { motion: 0.26, density: 0.34, tension: 0.5, brightness: 0.18 },
    mood: { melancholic: 0.5, distant: 0.44, contemplative: 0.36, porous: 0.28 },
  },
};

/** Multiplier on `lerp(MIN_BPM, MAX_BPM, motion)` for BPM. Per Jeremy's spec. */
export const PHASE_BPM_MULT: Record<TimePhase, number> = {
  witching_hour: 0.9,
  dawn: 1.02,
  morning: 1.0,
  noon: 1.04,
  afternoon: 1.02,
  golden_hour: 1.0,
  dusk: 0.95,
  night: 0.92,
};

/** BPM range — widened from Jeremy's 44–120 to match prior project ceiling. */
export const MIN_BPM = 44;
export const MAX_BPM = 176;

/** Body-activity → energy axis deltas. Applied on top of phase baseline. */
export const BODY_ENERGY_DELTA: Record<BodyActivity, Partial<EnergyAxes>> = {
  still: { motion: -0.04, density: -0.02 },
  walking: {},
  running: { motion: 0.12, density: 0.04, tension: 0.06 },
  vehicle: { motion: 0.02, density: 0.03 },
};

// ============================================================================
// Location modifiers — energy axis + mood deltas per location type.
// Location is a coloring layer, not the dominant signal — magnitudes match
// weather deltas (±0.04–0.12). Stacked inside the tide multiplier so spring
// moons amplify location pull and neap moons mellow it.
// ============================================================================

export const LOCATION_ENERGY_DELTA: Record<LocationType, Partial<EnergyAxes>> = {
  // Domestic
  home_interior: { motion: -0.05, density: -0.05, brightness: -0.04 },
  home_garden: { motion: -0.03, density: -0.02, brightness: 0.02 },

  // Work
  office: { motion: -0.03, density: 0.02, tension: 0.04, brightness: -0.02 },
  co_working_space: { motion: 0.02, density: 0.04, brightness: 0.02 },

  // Industrial
  factory_or_warehouse: { motion: 0.04, density: 0.08, tension: 0.06, brightness: -0.08 },
  construction_site: { motion: 0.05, density: 0.06, tension: 0.1, brightness: -0.04 },

  // Commerce
  retail_shop: { density: 0.02, brightness: 0.03 },
  shopping_mall: { motion: 0.04, density: 0.08, brightness: 0.06 },
  supermarket: { density: 0.06, brightness: 0.08, tension: 0.03 },
  outdoor_market: { motion: 0.08, density: 0.1, brightness: 0.05 },

  // Food / drink
  cafe: { motion: -0.02, density: 0.02, brightness: 0.02 },
  restaurant: { motion: 0.02, density: 0.06, brightness: 0.03 },
  bar_or_pub: { motion: 0.04, density: 0.06, brightness: -0.05 },
  nightclub: { motion: 0.15, density: 0.12, tension: 0.06, brightness: 0.05 },
  fast_food: { motion: 0.06, density: 0.04, brightness: 0.08, tension: 0.04 },
  food_truck_or_street_food: { motion: 0.08, density: 0.08, brightness: 0.04 },

  // Transit
  train_station: { motion: 0.08, density: 0.08, brightness: 0.02 },
  bus_station: { motion: 0.06, density: 0.06, brightness: -0.02 },
  airport: { motion: 0.06, density: 0.1, tension: 0.05, brightness: 0.04 },
  subway_or_metro: { motion: 0.08, density: 0.08, tension: 0.06, brightness: -0.08 },
  tunnel_or_underpass: { motion: 0.06, tension: 0.08, brightness: -0.1 },
  on_foot_street: { motion: 0.04, density: 0.04 },
  highway_or_motorway: { motion: 0.12, density: 0.04, tension: 0.04 },
  parking_lot_or_garage: { motion: -0.02, density: -0.02, brightness: -0.08 },

  // Urban open
  park_urban: { motion: -0.02, density: -0.02, brightness: 0.04 },
  plaza_or_public_square: { motion: 0.02, density: 0.04, brightness: 0.06 },
  rooftop: { motion: -0.02, brightness: 0.08, tension: -0.04 },
  alleyway_or_back_street: { motion: -0.02, density: -0.04, brightness: -0.1, tension: 0.06 },

  // Natural
  park_large_natural: { motion: -0.04, density: -0.06, brightness: 0.04 },
  forest_or_woods: { motion: -0.05, density: -0.04, brightness: -0.05 },
  mountain_or_hills: { motion: -0.04, density: -0.08, brightness: 0.06 },
  beach_or_coast: { motion: -0.02, density: -0.04, brightness: 0.1 },
  river_or_lake: { motion: -0.04, density: -0.06, brightness: 0.02 },
  ocean_or_open_water: { motion: -0.02, density: -0.1, brightness: 0.04 },
  desert_or_arid_land: { motion: -0.04, density: -0.1, brightness: 0.12, tension: 0.04 },
  field_or_meadow: { motion: -0.04, density: -0.08, brightness: 0.06 },
  cave_or_underground: { motion: -0.08, density: -0.04, brightness: -0.12, tension: 0.08 },

  // Cultural
  museum_or_gallery: { motion: -0.06, density: -0.04, tension: -0.04 },
  library: { motion: -0.08, density: -0.06, tension: -0.04, brightness: -0.02 },
  theatre_or_cinema: { motion: -0.04, density: -0.02, tension: 0.04, brightness: -0.1 },
  concert_venue: { motion: 0.08, density: 0.1, brightness: 0.04 },
  stadium_or_arena: { motion: 0.1, density: 0.12, tension: 0.06, brightness: 0.06 },

  // Active
  gym_or_fitness: { motion: 0.1, density: 0.08, tension: 0.05, brightness: 0.06 },

  // Civic / institutional
  school_or_university: { motion: 0.04, density: 0.04, brightness: 0.02 },
  hospital_or_clinic: { motion: -0.04, density: -0.02, tension: 0.1, brightness: 0.06 },
  government_building: { motion: -0.02, density: 0.02, tension: 0.04, brightness: -0.02 },

  // Spiritual / heritage
  place_of_worship: { motion: -0.08, density: -0.02, tension: -0.04, brightness: -0.02 },
  historic_site: { motion: -0.04, density: -0.02, brightness: -0.02 },

  // Remote
  rural_settlement: { motion: -0.04, density: -0.06, brightness: 0.02 },
  wilderness_or_remote: { motion: -0.06, density: -0.12, brightness: 0.04 },

  unknown: {},
};

export const LOCATION_MOOD_DELTA: Record<LocationType, MoodWeights> = {
  home_interior: { intimate: 0.08, grounded: 0.05, contemplative: 0.04 },
  home_garden: { calm: 0.06, grounded: 0.04, open: 0.03 },

  office: { focused: 0.08, practical: 0.06, neutral: 0.04 },
  co_working_space: { focused: 0.05, social: 0.04, purposeful: 0.05 },

  factory_or_warehouse: { mechanical: 0.1, distant: 0.05, stark: 0.04 },
  construction_site: { restless: 0.06, mechanical: 0.07, urgent: 0.04 },

  retail_shop: { practical: 0.05, neutral: 0.03 },
  shopping_mall: { extroverted: 0.06, anonymous: 0.05, social: 0.04 },
  supermarket: { practical: 0.06, anonymous: 0.06, neutral: 0.04 },
  outdoor_market: { social: 0.08, playful: 0.05, expansive: 0.04 },

  cafe: { intimate: 0.06, warm: 0.05, social: 0.04 },
  restaurant: { warm: 0.06, social: 0.05, intimate: 0.03 },
  bar_or_pub: { social: 0.07, warm: 0.06, intimate: 0.05 },
  nightclub: { charged: 0.12, expansive: 0.08, social: 0.08, playful: 0.05 },
  fast_food: { restless: 0.05, anonymous: 0.04, urgent: 0.03 },
  food_truck_or_street_food: { social: 0.06, playful: 0.05, warm: 0.04 },

  train_station: { transient: 0.08, anonymous: 0.06, anticipatory: 0.05 },
  bus_station: { transient: 0.06, fatigued: 0.04, anonymous: 0.05 },
  airport: { transient: 0.07, anticipatory: 0.06, anonymous: 0.06, suspended: 0.04 },
  subway_or_metro: { anonymous: 0.06, distant: 0.05, mechanical: 0.06, transient: 0.05 },
  tunnel_or_underpass: { suspended: 0.06, uncanny: 0.05, mechanical: 0.04 },
  on_foot_street: { neutral: 0.04, transient: 0.04, anonymous: 0.03 },
  highway_or_motorway: { distant: 0.06, mechanical: 0.06, drifting: 0.05 },
  parking_lot_or_garage: { stark: 0.05, neutral: 0.04, isolated: 0.04 },

  park_urban: { calm: 0.05, social: 0.04, grounded: 0.03 },
  plaza_or_public_square: { expansive: 0.06, social: 0.05, open: 0.04 },
  rooftop: { expansive: 0.08, luminous: 0.05, drifting: 0.04 },
  alleyway_or_back_street: { uncanny: 0.07, isolated: 0.05, intimate: 0.04 },

  park_large_natural: { expansive: 0.06, calm: 0.05, open: 0.04 },
  forest_or_woods: { intimate: 0.06, contemplative: 0.05, hushed: 0.04 },
  mountain_or_hills: { expansive: 0.1, awe: 0.05, distant: 0.04 },
  beach_or_coast: { expansive: 0.08, drifting: 0.06, open: 0.05 },
  river_or_lake: { reflective: 0.06, calm: 0.05, drifting: 0.04 },
  ocean_or_open_water: { expansive: 0.1, drifting: 0.07, awe: 0.04 },
  desert_or_arid_land: { stark: 0.08, isolated: 0.06, expansive: 0.05 },
  field_or_meadow: { calm: 0.06, open: 0.05, grounded: 0.04 },
  cave_or_underground: { uncanny: 0.1, suspended: 0.06, intimate: 0.04 },

  museum_or_gallery: { contemplative: 0.08, focused: 0.05, reverent: 0.04 },
  library: { introspective: 0.08, focused: 0.06, contemplative: 0.05 },
  theatre_or_cinema: { suspended: 0.06, anticipatory: 0.05, intimate: 0.04 },
  concert_venue: { expansive: 0.07, charged: 0.06, social: 0.05 },
  stadium_or_arena: { charged: 0.1, expansive: 0.08, social: 0.06 },

  gym_or_fitness: { charged: 0.08, purposeful: 0.06, urgent: 0.04 },

  school_or_university: { purposeful: 0.06, focused: 0.05, social: 0.04 },
  hospital_or_clinic: { fragile: 0.07, anxious: 0.05, sterile: 0.06, tender: 0.04 },
  government_building: { serious: 0.06, neutral: 0.05, stark: 0.04 },

  place_of_worship: { reverent: 0.1, suspended: 0.06, contemplative: 0.05, intimate: 0.04 },
  historic_site: { reverent: 0.06, nostalgic: 0.05, contemplative: 0.04 },

  rural_settlement: { calm: 0.06, grounded: 0.05, distant: 0.04 },
  wilderness_or_remote: { isolated: 0.08, expansive: 0.07, sparse: 0.06, awe: 0.04 },

  unknown: {},
};
