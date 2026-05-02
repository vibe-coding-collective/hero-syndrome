import type {
  ClaudePromptJson,
  CloudCoverBucket,
  DayOfWeek,
  HumidityBucket,
  IntensityBucket,
  MotionClass,
  MovementPattern,
  MusicalPicks,
  PrecipitationBucket,
  TempCBucket,
  ThresholdBucket,
  TimePhase,
  WeatherCondition,
  WindBucket,
} from '@hero-syndrome/shared';
import schemaJson from '../data/schema.json' with { type: 'json' };

// =========================================================================
// Schema types — keyed by the actual enums in @hero-syndrome/shared so a
// missing enum value is a tsc error, not a runtime surprise.
// =========================================================================

export type {
  CloudCoverBucket,
  HumidityBucket,
  IntensityBucket,
  MusicalPicks,
  PrecipitationBucket,
  TempCBucket,
  ThresholdBucket,
  WindBucket,
};

export interface MusicalSchema {
  version: string;
  phase: Record<TimePhase, {
    tempo: number[];
    key: string[];
    instrumentationBase: string[];
  }>;
  dayOfWeek: Record<DayOfWeek, {
    dayAccent: string[];
  }>;
  condition: Record<WeatherCondition, {
    reverb: string[];
    dynamics: string[];
    color: string[];
  }>;
  tempC: {
    thresholds: { coldMax: number; coolMax: number; mildMax: number; warmMax: number };
    buckets: Record<TempCBucket, { tonalWarmth: string[] }>;
  };
  humidityPct: {
    thresholds: { dryMax: number; moderateMax: number };
    buckets: Record<HumidityBucket, { airDensity: string[] }>;
  };
  precipitationMmHr: {
    thresholds: { lightMax: number; moderateMax: number };
    buckets: Record<PrecipitationBucket, { textureOverlay: string[] }>;
  };
  cloudCoverPct: {
    thresholds: { clearMax: number; partialMax: number };
    buckets: Record<CloudCoverBucket, { brightnessMask: string[] }>;
  };
  windMps: {
    thresholds: { calmMax: number; breezyMax: number; windyMax: number };
    buckets: Record<WindBucket, { motionModulation: string[] }>;
  };
  isDay: Record<'true' | 'false', { lighting: string[] }>;
  thresholdProximity: {
    windowMinutes: number;
    buckets: Record<ThresholdBucket, { thresholdAccent: string[] }>;
  };
  activity: Record<MotionClass, {
    tempoAdjustment: number[];
    articulation: string[];
  }>;
  motion: Record<MovementPattern, { phraseShape: string[] }>;
  intensity: Record<IntensityBucket, { dynamicRange: string[] }>;
  tempoTerms: Array<{ min: number; max: number; term: string }>;
}

// Cast forces tsc to verify every enum key exists in the JSON. If a value is
// added to an enum and not to the JSON, this line fails to compile.
export const SCHEMA = schemaJson as MusicalSchema;

// =========================================================================
// Bucketing functions for continuous inputs.
// =========================================================================

export function bucketTempC(c: number): TempCBucket {
  const t = SCHEMA.tempC.thresholds;
  if (c < t.coldMax) return 'cold';
  if (c < t.coolMax) return 'cool';
  if (c < t.mildMax) return 'mild';
  if (c < t.warmMax) return 'warm';
  return 'hot';
}

export function bucketHumidity(h: number): HumidityBucket {
  const t = SCHEMA.humidityPct.thresholds;
  if (h < t.dryMax) return 'dry';
  if (h < t.moderateMax) return 'moderate';
  return 'humid';
}

export function bucketPrecipitation(p: number): PrecipitationBucket {
  const t = SCHEMA.precipitationMmHr.thresholds;
  if (p <= 0) return 'none';
  if (p < t.lightMax) return 'light';
  if (p < t.moderateMax) return 'moderate';
  return 'heavy';
}

export function bucketCloudCover(c: number): CloudCoverBucket {
  const t = SCHEMA.cloudCoverPct.thresholds;
  if (c < t.clearMax) return 'clear';
  if (c < t.partialMax) return 'partial';
  return 'overcast';
}

export function bucketWind(w: number): WindBucket {
  const t = SCHEMA.windMps.thresholds;
  if (w < t.calmMax) return 'calm';
  if (w < t.breezyMax) return 'breezy';
  if (w < t.windyMax) return 'windy';
  return 'gale';
}

export function lookupTempoTerm(bpm: number): string {
  for (const r of SCHEMA.tempoTerms) {
    if (bpm >= r.min && bpm < r.max) return r.term;
  }
  return SCHEMA.tempoTerms[SCHEMA.tempoTerms.length - 1]?.term ?? 'Andante';
}

// =========================================================================
// Picker — consumes quantum bytes in order, returns MusicalPicks.
// =========================================================================

class BytePicker {
  private idx = 0;
  constructor(private readonly bytes: readonly number[]) {}

  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('cannot pick from empty list');
    const byte = this.bytes[this.idx++ % this.bytes.length]!;
    return list[byte % list.length]!;
  }

  consumed(): number {
    return this.idx;
  }
}

export interface MakePicksInput {
  state: ClaudePromptJson['state'];
  /** Quantum bytes — at least 18 needed for a fully-populated state. The
   *  consumer should pull more (32 is the standard) so the phrase derivation
   *  and any future picks have headroom. */
  bytes: number[];
}

export function makePicks(input: MakePicksInput): MusicalPicks {
  const { state } = input;
  const picker = new BytePicker(input.bytes);

  // L1.phase
  const phaseEntry = SCHEMA.phase[state.time.phase];
  const tempo = picker.pick(phaseEntry.tempo);
  const key = picker.pick(phaseEntry.key);
  const instrumentationBase = picker.pick(phaseEntry.instrumentationBase);

  // L1.dayOfWeek
  const dayEntry = SCHEMA.dayOfWeek[state.time.dayOfWeek];
  const dayAccent = picker.pick(dayEntry.dayAccent);

  // L2.condition + continuous (only if weather present)
  let condition: WeatherCondition | undefined;
  let reverb: string | undefined;
  let dynamics: string | undefined;
  let color: string | undefined;
  let tempCBucket: TempCBucket | undefined;
  let tonalWarmth: string | undefined;
  let humidityBucket: HumidityBucket | undefined;
  let airDensity: string | undefined;
  let precipitationBucket: PrecipitationBucket | undefined;
  let textureOverlay: string | undefined;
  let cloudCoverBucket: CloudCoverBucket | undefined;
  let brightnessMask: string | undefined;
  let windBucket: WindBucket | undefined;
  let motionModulation: string | undefined;
  let isDayValue: boolean | undefined;
  let lighting: string | undefined;
  let threshold: ThresholdBucket | undefined;
  let thresholdAccent: string | undefined;

  if (state.weather) {
    const w = state.weather;
    condition = w.condition;
    const condEntry = SCHEMA.condition[w.condition];
    reverb = picker.pick(condEntry.reverb);
    dynamics = picker.pick(condEntry.dynamics);
    color = picker.pick(condEntry.color);

    tempCBucket = bucketTempC(w.tempC);
    tonalWarmth = picker.pick(SCHEMA.tempC.buckets[tempCBucket].tonalWarmth);

    humidityBucket = bucketHumidity(w.humidityPct);
    airDensity = picker.pick(SCHEMA.humidityPct.buckets[humidityBucket].airDensity);

    precipitationBucket = bucketPrecipitation(w.precipitationMmHr);
    textureOverlay = picker.pick(SCHEMA.precipitationMmHr.buckets[precipitationBucket].textureOverlay);

    cloudCoverBucket = bucketCloudCover(w.cloudCoverPct);
    brightnessMask = picker.pick(SCHEMA.cloudCoverPct.buckets[cloudCoverBucket].brightnessMask);

    windBucket = bucketWind(w.windMps);
    motionModulation = picker.pick(SCHEMA.windMps.buckets[windBucket].motionModulation);

    isDayValue = w.isDay;
    lighting = picker.pick(SCHEMA.isDay[w.isDay ? 'true' : 'false'].lighting);

    // Threshold accent: fires only if within ±windowMinutes of sunrise OR sunset.
    // If both fire (rare), the next byte chooses which.
    const window = SCHEMA.thresholdProximity.windowMinutes;
    const nearSunrise = Math.abs(w.sunriseProximityMin) <= window;
    const nearSunset = Math.abs(w.sunsetProximityMin) <= window;
    if (nearSunrise && nearSunset) {
      // Use one byte for the coin flip, then pick the actual element.
      threshold = picker.pick<ThresholdBucket>(['nearSunrise', 'nearSunset']);
      thresholdAccent = picker.pick(SCHEMA.thresholdProximity.buckets[threshold].thresholdAccent);
    } else if (nearSunrise) {
      threshold = 'nearSunrise';
      thresholdAccent = picker.pick(SCHEMA.thresholdProximity.buckets.nearSunrise.thresholdAccent);
    } else if (nearSunset) {
      threshold = 'nearSunset';
      thresholdAccent = picker.pick(SCHEMA.thresholdProximity.buckets.nearSunset.thresholdAccent);
    }
  }

  // L3.activity
  const actEntry = SCHEMA.activity[state.body.activity];
  const tempoAdjustment = picker.pick(actEntry.tempoAdjustment);
  const articulation = picker.pick(actEntry.articulation);

  // L3.motion
  const motEntry = SCHEMA.motion[state.body.motion];
  const phraseShape = picker.pick(motEntry.phraseShape);

  // L3.intensity
  const intEntry = SCHEMA.intensity[state.body.intensity];
  const dynamicRange = picker.pick(intEntry.dynamicRange);

  const finalBpm = tempo + tempoAdjustment;
  const tempoTerm = lookupTempoTerm(finalBpm);

  const inputs: MusicalPicks['inputs'] = {
    phase: state.time.phase,
    dayOfWeek: state.time.dayOfWeek,
    activity: state.body.activity,
    motion: state.body.motion,
    intensity: state.body.intensity,
  };
  if (condition !== undefined) inputs.condition = condition;
  if (tempCBucket !== undefined) inputs.tempCBucket = tempCBucket;
  if (humidityBucket !== undefined) inputs.humidityBucket = humidityBucket;
  if (precipitationBucket !== undefined) inputs.precipitationBucket = precipitationBucket;
  if (cloudCoverBucket !== undefined) inputs.cloudCoverBucket = cloudCoverBucket;
  if (windBucket !== undefined) inputs.windBucket = windBucket;
  if (isDayValue !== undefined) inputs.isDay = isDayValue;
  if (threshold !== undefined) inputs.threshold = threshold;

  const picks: MusicalPicks['picks'] = {
    tempo,
    key,
    instrumentationBase,
    dayAccent,
    tempoAdjustment,
    articulation,
    phraseShape,
    dynamicRange,
  };
  if (reverb !== undefined) picks.reverb = reverb;
  if (dynamics !== undefined) picks.dynamics = dynamics;
  if (color !== undefined) picks.color = color;
  if (tonalWarmth !== undefined) picks.tonalWarmth = tonalWarmth;
  if (airDensity !== undefined) picks.airDensity = airDensity;
  if (textureOverlay !== undefined) picks.textureOverlay = textureOverlay;
  if (brightnessMask !== undefined) picks.brightnessMask = brightnessMask;
  if (motionModulation !== undefined) picks.motionModulation = motionModulation;
  if (lighting !== undefined) picks.lighting = lighting;
  if (thresholdAccent !== undefined) picks.thresholdAccent = thresholdAccent;

  return {
    schemaVersion: SCHEMA.version,
    inputs,
    picks,
    derived: { finalBpm, tempoTerm },
  };
}

// =========================================================================
// Directorial block — paragraph prose embedded in the user message.
// =========================================================================

export function composeDirectorialBlock(p: MusicalPicks): string {
  const { picks: q, derived } = p;
  const adj = q.tempoAdjustment >= 0 ? `+${q.tempoAdjustment}` : `${q.tempoAdjustment}`;

  const lines: string[] = ['# Musical scaffolding', ''];

  lines.push(`Tempo: ${derived.finalBpm} BPM (${derived.tempoTerm}; base ${q.tempo} BPM with ${adj} BPM body adjustment)`);
  lines.push(`Key/mode: ${q.key}`);
  lines.push(`Instrumentation base: ${q.instrumentationBase}`);
  lines.push(`Day accent: ${q.dayAccent}`);
  if (q.color) lines.push(`Weather color: ${q.color}`);
  if (q.tonalWarmth) lines.push(`Tonal warmth: ${q.tonalWarmth}`);
  if (q.airDensity) lines.push(`Air density: ${q.airDensity}`);
  if (q.brightnessMask) lines.push(`Brightness mask: ${q.brightnessMask}`);
  if (q.motionModulation) lines.push(`Motion modulation: ${q.motionModulation}`);
  if (q.lighting) lines.push(`Lighting: ${q.lighting}`);
  if (q.thresholdAccent) lines.push(`Threshold accent: ${q.thresholdAccent}`);
  if (q.reverb) lines.push(`Reverb: ${q.reverb}`);
  if (q.dynamics) lines.push(`Dynamics: ${q.dynamics}`);
  lines.push(`Overall dynamic range: ${q.dynamicRange}`);
  lines.push(`Articulation: ${q.articulation}`);
  lines.push(`Phrase shape: ${q.phraseShape}`);
  if (q.textureOverlay) lines.push(`Texture overlay: ${q.textureOverlay}`);

  lines.push('');
  lines.push(
    'Section prompts must explicitly embed the BPM (or a narrow range), key/mode, lead instrumentation, and the dynamic descriptor in their prose so metadata and section prompts agree. Treat the constraints above as a constellation, not a recipe — choose section count, transitions, intros and outros, and modal flavoring within these constraints.',
  );

  return lines.join('\n');
}
