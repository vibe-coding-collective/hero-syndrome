import type {
  BodyActivity,
  DayOfWeek,
  LocationType,
  TimePhase,
  WeatherCondition,
} from '@hero-syndrome/shared';
import {
  BODY_ENERGY_DELTA,
  DAY_ENERGY_DELTA,
  DAY_MOOD_DELTA,
  LOCATION_ENERGY_DELTA,
  LOCATION_MOOD_DELTA,
  LOCATION_MOOD_SENSITIVITY,
  LUNAR_SENS_BY_PHASE,
  MOON_UNDERTOW_TARGETS,
  PHASE_ENERGY_MOOD_INSPIRATION,
  PHASE_TEXTURE_KEYS,
  PHASE_WORLD,
  TIDE_RANGE_MULT,
  TIME_MOOD_SENSITIVITY,
  WEATHER_MOOD_DELTA,
  WEATHER_MOOD_SENSITIVITY,
  WEATHER_WORLD_TARGETS,
} from './constants';
import { normalizeWeatherCondition } from './normalize';
import type {
  EnergyAxes,
  InspirationState,
  MoodWeights,
  PipelineInput,
  StackedMeta,
} from './types';

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function mergeWeights(a: MoodWeights, b: MoodWeights, scaleB = 1): MoodWeights {
  const out: MoodWeights = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v * scaleB;
  }
  return out;
}

function applyEnergyDelta(e: EnergyAxes, delta: Partial<EnergyAxes>): EnergyAxes {
  return {
    motion: clamp01(e.motion + (delta.motion ?? 0)),
    density: clamp01(e.density + (delta.density ?? 0)),
    tension: clamp01(e.tension + (delta.tension ?? 0)),
    brightness: clamp01(e.brightness + (delta.brightness ?? 0)),
  };
}

function applyDayEnergyDelta(e: EnergyAxes, day: DayOfWeek): EnergyAxes {
  const d = DAY_ENERGY_DELTA[day];
  return {
    motion: clamp01(e.motion + d),
    density: clamp01(e.density + d),
    tension: clamp01(e.tension + d * 0.5),
    brightness: clamp01(e.brightness + d * 0.7),
  };
}

function applyBodyEnergyDelta(e: EnergyAxes, body?: BodyActivity): EnergyAxes {
  if (!body) return e;
  return applyEnergyDelta(e, BODY_ENERGY_DELTA[body]);
}

function applyLocationEnergyDelta(
  e: EnergyAxes,
  location?: LocationType,
): EnergyAxes {
  if (!location) return e;
  return applyEnergyDelta(e, LOCATION_ENERGY_DELTA[location]);
}

export interface StackOptions {
  undertowSmooth?: MoodWeights;
  lunarStrength?: number;
  undertowInstantStrength?: number;
}

/**
 * Full modifier stack: time-phase baseline → day delta → body delta → location
 * delta → weather + moon (mood only) → undertow. Per Jeremy's spec with
 * location added as a sibling of weather/day.
 */
export function stackMeta(input: PipelineInput, options?: StackOptions): StackedMeta {
  const { timePhase, dayOfWeek, moonPhase, bodyActivity, locationType } = input;
  const weatherCondition = normalizeWeatherCondition(
    input.weatherCondition as string,
  ) as WeatherCondition;

  const base = PHASE_ENERGY_MOOD_INSPIRATION[timePhase];
  if (!base) throw new Error(`Unknown time phase: ${String(timePhase)}`);

  // Energy: phase baseline + day + body + location.
  let energy = applyDayEnergyDelta({ ...base.energy }, dayOfWeek);
  energy = applyBodyEnergyDelta(energy, bodyActivity);
  energy = applyLocationEnergyDelta(energy, locationType);

  // Mood: build up the deltas, scale by sensitivities, apply tide multiplier.
  const timeSens = TIME_MOOD_SENSITIVITY[timePhase];
  const weatherSens = WEATHER_MOOD_SENSITIVITY[timePhase];
  const locationSens = LOCATION_MOOD_SENSITIVITY[timePhase];

  const dayMoodPart: MoodWeights = {};
  for (const [tag, w] of Object.entries(DAY_MOOD_DELTA[dayOfWeek])) {
    dayMoodPart[tag] = w * timeSens;
  }

  const weatherPart: MoodWeights = {};
  const weatherDeltaTable = WEATHER_MOOD_DELTA[weatherCondition];
  if (weatherDeltaTable) {
    for (const [tag, w] of Object.entries(weatherDeltaTable)) {
      weatherPart[tag] = w * weatherSens;
    }
  }

  const locationPart: MoodWeights = {};
  if (locationType) {
    for (const [tag, w] of Object.entries(LOCATION_MOOD_DELTA[locationType])) {
      locationPart[tag] = w * locationSens;
    }
  }

  const combinedDelta = mergeWeights(
    mergeWeights(dayMoodPart, weatherPart, 1),
    locationPart,
    1,
  );

  // Moon: tide range scales fast deltas; undertow adds slow bias.
  const lunarSens = LUNAR_SENS_BY_PHASE[timePhase];
  const lunarStrength = options?.lunarStrength ?? 0.8;
  const tideRangeMult = TIDE_RANGE_MULT[moonPhase];
  const tideEffective = 1 + (tideRangeMult - 1) * lunarSens * lunarStrength;

  const undertowInstant = options?.undertowInstantStrength ?? 0.65;
  const undertowFromMoon: MoodWeights = {};
  for (const [tag, w] of Object.entries(MOON_UNDERTOW_TARGETS[moonPhase])) {
    undertowFromMoon[tag] = w * lunarSens * undertowInstant;
  }
  const undertow = options?.undertowSmooth ?? undertowFromMoon;

  // Mood: baseline + combined deltas × tide + undertow, all clamped.
  const mood: MoodWeights = { ...base.mood };
  for (const [tag, delta] of Object.entries(combinedDelta)) {
    mood[tag] = clamp01((mood[tag] ?? 0) + delta * tideEffective);
  }
  for (const [tag, w] of Object.entries(undertow)) {
    mood[tag] = clamp01((mood[tag] ?? 0) + w);
  }

  // Inspiration: phase world + weather-blend secondary + phase textures.
  const primaryWorld = PHASE_WORLD[timePhase];
  const weatherWorlds = WEATHER_WORLD_TARGETS[weatherCondition] ?? [];
  const secondary = weatherWorlds.find((w) => w !== primaryWorld) ?? weatherWorlds[0];

  const inspiration: InspirationState = {
    world: primaryWorld,
    textureKeys: [...PHASE_TEXTURE_KEYS[timePhase]],
  };
  if (secondary && secondary !== primaryWorld) inspiration.worldSecondary = secondary;

  return {
    energy,
    mood,
    inspiration,
    tideEffective,
    weatherCondition,
    timePhase,
    moonPhase,
  };
}
