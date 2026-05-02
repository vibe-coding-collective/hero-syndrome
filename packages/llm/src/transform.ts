import type {
  ClaudePromptJson,
  MeasuredFeatures,
  SongMetadata,
  StateVector,
  Sticker,
} from '@hero-syndrome/shared';

export interface BuildPromptInput {
  stateVector: StateVector;
  stickers: Sticker[];
  vibes: {
    wordOfTheMoment?: string;
    phraseOfTheMoment?: string;
  };
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
}

function intensityBucket(v: number): 'low' | 'moderate' | 'high' {
  if (v < 0.33) return 'low';
  if (v < 0.66) return 'moderate';
  return 'high';
}

export function buildClaudePromptJson(input: BuildPromptInput): ClaudePromptJson {
  const sv = input.stateVector;

  const body: ClaudePromptJson['state']['body'] = {
    activity: sv.location?.motionClass ?? 'still',
    motion: sv.movement.pattern,
    intensity: intensityBucket(sv.movement.intensityNormalized),
  };

  const out: ClaudePromptJson = {
    state: {
      timestamp: sv.timestamp,
      time: sv.time,
      body,
    },
    userInput: [],
    vibes: {},
    recentHistory: input.recentHistory,
  };

  if (sv.location) {
    const loc: NonNullable<ClaudePromptJson['state']['location']> = {};
    if (sv.location.placeType && sv.location.placeType !== 'unknown') loc.placeType = sv.location.placeType;
    if (sv.location.place?.type) {
      const place: { type: string; name?: string } = { type: sv.location.place.type };
      if (sv.location.place.name) place.name = sv.location.place.name;
      loc.place = place;
    }
    if (sv.location.city) loc.city = sv.location.city;
    if (sv.location.country) loc.country = sv.location.country;
    if (sv.location.nearby && sv.location.nearby.length > 0) loc.nearby = sv.location.nearby;
    if (Object.keys(loc).length > 0) out.state.location = loc;
  }

  if (sv.weather) out.state.weather = sv.weather;

  if (input.vibes.wordOfTheMoment) out.vibes.wordOfTheMoment = input.vibes.wordOfTheMoment;
  if (input.vibes.phraseOfTheMoment) out.vibes.phraseOfTheMoment = input.vibes.phraseOfTheMoment;

  return out;
}
