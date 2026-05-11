import type {
  ClaudePromptJson,
  LexiconContextDict,
  LocationType,
  MeasuredFeatures,
  MoonPhase,
  RenderPlan,
  SongMetadata,
  StackedMeta,
  StateVector,
} from '@hero-syndrome/shared';

export interface BuildPromptInput {
  stateVector: StateVector;
  moonPhase: MoonPhase;
  stacked: StackedMeta;
  renderPlan: RenderPlan;
  lexicon: LexiconContextDict;
  locationType?: LocationType;
  vibes: {
    phraseOfTheMoment?: string;
  };
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
}

export function buildClaudePromptJson(input: BuildPromptInput): ClaudePromptJson {
  const sv = input.stateVector;

  const out: ClaudePromptJson = {
    state: {
      timestamp: sv.timestamp,
      time: sv.time,
      moonPhase: input.moonPhase,
    },
    stacked: input.stacked,
    renderPlan: {
      bpm: input.renderPlan.bpm,
      totalDurationMs: input.renderPlan.totalDurationMs,
    },
    lexicon: input.lexicon,
    vibes: {},
    recentHistory: input.recentHistory,
  };

  if (sv.location?.bodyActivity) {
    out.state.body = { activity: sv.location.bodyActivity };
  }

  if (sv.location || input.locationType) {
    const loc: NonNullable<ClaudePromptJson['state']['location']> = {
      type: input.locationType ?? 'unknown',
    };
    if (sv.location?.place?.type) {
      const place: { type: string; name?: string } = { type: sv.location.place.type };
      if (sv.location.place.name) place.name = sv.location.place.name;
      loc.place = place;
    }
    if (sv.location?.city) loc.city = sv.location.city;
    if (sv.location?.country) loc.country = sv.location.country;
    if (sv.location?.nearby && sv.location.nearby.length > 0) {
      loc.nearby = sv.location.nearby;
    }
    out.state.location = loc;
  }

  if (sv.weather) out.state.weather = sv.weather;

  if (input.vibes.phraseOfTheMoment) {
    out.vibes.phraseOfTheMoment = input.vibes.phraseOfTheMoment;
  }

  return out;
}
