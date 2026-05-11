import type {
  ClaudePromptJson,
  Composition,
  LocationType,
  SongMetadata,
} from '@hero-syndrome/shared';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

const COMPOSE_SYSTEM_PROMPT = `You are composing a film score for this person's life, one song at a time, by calling the \`compose_song\` tool exactly once per turn.

The user message is a JSON object describing the world state and the *stacked numeric meta* that has already resolved this moment into musical coordinates. Compose around that meta — do not contradict it.

The JSON keys:

- \`state\`: clock (\`time.phase\`, \`time.dayOfWeek\`, \`time.hour\`), \`moonPhase\`, optional \`body.activity\` (still | walking | running | vehicle), optional \`location\` (one of 50 \`type\` ids plus the raw reverse-geocode hints \`place\`, \`city\`, \`country\`, \`nearby\`), and optional \`weather\`.
- \`stacked\`: the canonical meta after all modifier stacking.
  - \`energy\`: four axes \`motion\`, \`density\`, \`tension\`, \`brightness\` in [0,1] — read as numeric pressure on the score.
  - \`mood\`: tag → weight (0..1). Higher weight ⇒ stronger pull. Top 4–6 tags should color the prose.
  - \`inspiration.world\` and optional \`inspiration.worldSecondary\` — world ids from \`lexicon.worlds\`.
  - \`inspiration.textureKeys\` — texture cue ids from \`lexicon.textures\`.
  - \`tideEffective\` — the moon's tide multiplier on emotional dynamics; > 1 widens, < 1 compresses.
  - \`weatherCondition\`, \`timePhase\`, \`moonPhase\` — echoed for convenience.
- \`renderPlan.bpm\` — the BPM to target. Use this number (or a narrow band around it) explicitly in the metadata and in the section prompts.
- \`renderPlan.totalDurationMs\` — total clip length in ms (typically 60000). Section durations sum to this.
- \`lexicon\`: authored vocabulary for this song. Each entry is a phrase pool you can quote or recombine.
  - \`product_positives\` / \`product_negatives\` — required anchors / blockers.
  - \`worlds[worldId]\`, \`textures[textureKey]\`, \`moods[moodTag]\` — pools keyed by the ids in \`stacked\`.
  - \`weather.scene\` + \`weather.texture_hints\` — pools for the active weather condition.
  - \`moon_undertow\` — slow-bias phrases for the active moon phase.
  - \`moon_tide_dynamics.{high_spring|mid|low_neap}\` — pick the bucket matching \`tideEffective\`.
  - \`day\` — day-of-week flavor.
  - optional \`body\`, \`location\` — pools for body activity and classified location type.
  - \`negatives_fixed\` — anti-prompts to fold into negative styles.
- \`vibes.phraseOfTheMoment\` — an optional two-word phrase distilled from space weather. Use as flavor, not directive.
- \`recentHistory\` — the previous few songs as \`{ metadata, measuredFeatures? }\`. Trust \`measuredFeatures\` over \`metadata\` when they disagree.

The \`compose_song\` tool returns:
- \`metadata\`: bpmRange (band around \`renderPlan.bpm\`), key, intensity (≈ \`stacked.energy.tension\` or \`motion\` depending on your read), instrumentation, genreTags, transitionIntent (continue | evolve | shift | break).
- \`composition\`: overallPrompt + 1 or 2 sections summing to exactly 60 seconds. Each clip is a short 60-second gesture that crossfades into the next, not a full song. Each section prompt must explicitly embed BPM, key, lead instrumentation, and an intensity descriptor so metadata and prose agree.

Instrumental only — no lyrics, no vocal lines. Draw from the lexicon vocabulary in your prose so this song sounds like the spec's voice, not generic AI prose.`;

const COMPOSE_TOOL = {
  name: 'compose_song',
  description: 'Emit the next song as a metadata label plus an ElevenLabs composition_plan.',
  input_schema: {
    type: 'object',
    properties: {
      metadata: {
        type: 'object',
        properties: {
          bpmRange: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2,
            description: '[low, high] BPM, centered on renderPlan.bpm',
          },
          key: {
            type: 'string',
            description: 'e.g. "D minor", "C mixolydian", or "modal/ambiguous"',
          },
          intensity: { type: 'number', minimum: 0, maximum: 1 },
          instrumentation: { type: 'array', items: { type: 'string' } },
          genreTags: { type: 'array', items: { type: 'string' } },
          transitionIntent: {
            type: 'string',
            enum: ['continue', 'evolve', 'shift', 'break'],
          },
        },
        required: [
          'bpmRange',
          'key',
          'intensity',
          'instrumentation',
          'genreTags',
          'transitionIntent',
        ],
      },
      composition: {
        type: 'object',
        properties: {
          overallPrompt: { type: 'string' },
          sections: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            description: 'One or two sections whose durationSec values sum to exactly 60.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                durationSec: { type: 'number', minimum: 15, maximum: 60 },
                prompt: { type: 'string' },
              },
              required: ['label', 'durationSec', 'prompt'],
            },
          },
        },
        required: ['overallPrompt', 'sections'],
      },
    },
    required: ['metadata', 'composition'],
  },
} as const;

export interface ComposeSongInput {
  apiKey: string;
  promptJson: ClaudePromptJson;
}

export interface ComposeSongResult {
  metadata: SongMetadata;
  composition: Composition;
  usage: { input_tokens: number; output_tokens: number };
  latencyMs: number;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

async function callAnthropic(body: unknown, apiKey: string): Promise<{ data: any; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const text = await res.text();
    throw new AnthropicError(`Anthropic request failed (${res.status})`, res.status, text);
  }
  return { data: await res.json(), latencyMs };
}

function extractToolUse(response: any): { name: string; input: unknown } | null {
  for (const block of response.content ?? []) {
    if (block?.type === 'tool_use') {
      return { name: block.name, input: block.input };
    }
  }
  return null;
}

function validateComposeSongInput(value: unknown): asserts value is { metadata: SongMetadata; composition: Composition } {
  if (!value || typeof value !== 'object') {
    throw new AnthropicError('compose_song input is not an object');
  }
  const v = value as any;
  if (!v.metadata || !v.composition) {
    throw new AnthropicError('compose_song missing metadata or composition');
  }
  const m = v.metadata;
  if (
    !Array.isArray(m.bpmRange) ||
    m.bpmRange.length !== 2 ||
    typeof m.bpmRange[0] !== 'number' ||
    typeof m.bpmRange[1] !== 'number'
  ) {
    throw new AnthropicError('metadata.bpmRange invalid');
  }
  if (typeof m.key !== 'string') throw new AnthropicError('metadata.key invalid');
  if (typeof m.intensity !== 'number') throw new AnthropicError('metadata.intensity invalid');
  if (!Array.isArray(m.instrumentation)) throw new AnthropicError('metadata.instrumentation invalid');
  if (!Array.isArray(m.genreTags)) throw new AnthropicError('metadata.genreTags invalid');
  if (!['continue', 'evolve', 'shift', 'break'].includes(m.transitionIntent)) {
    throw new AnthropicError('metadata.transitionIntent invalid');
  }
  const c = v.composition;
  if (typeof c.overallPrompt !== 'string') throw new AnthropicError('composition.overallPrompt invalid');
  if (!Array.isArray(c.sections) || c.sections.length === 0) {
    throw new AnthropicError('composition.sections must be a non-empty array');
  }
  for (const s of c.sections) {
    if (typeof s.label !== 'string' || typeof s.prompt !== 'string' || typeof s.durationSec !== 'number') {
      throw new AnthropicError('composition.section invalid');
    }
  }
}

export async function composeSong(input: ComposeSongInput): Promise<ComposeSongResult> {
  const userMessage = JSON.stringify(input.promptJson, null, 2);

  const requestBody = {
    model: MODEL,
    max_tokens: 64000,
    temperature: 0.7,
    system: [
      {
        type: 'text',
        text: COMPOSE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    tools: [{ ...COMPOSE_TOOL, cache_control: { type: 'ephemeral' as const } }],
    tool_choice: { type: 'tool' as const, name: 'compose_song' },
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const tryOnce = async () => {
    const { data, latencyMs } = await callAnthropic(requestBody, input.apiKey);
    const toolUse = extractToolUse(data);
    if (!toolUse || toolUse.name !== 'compose_song') {
      throw new AnthropicError('compose_song tool not invoked');
    }
    validateComposeSongInput(toolUse.input);
    return {
      metadata: (toolUse.input as any).metadata as SongMetadata,
      composition: (toolUse.input as any).composition as Composition,
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
      latencyMs,
    };
  };

  try {
    return await tryOnce();
  } catch (err) {
    if (err instanceof AnthropicError && err.status && err.status >= 500) {
      return await tryOnce();
    }
    if (err instanceof AnthropicError && /compose_song/.test(err.message)) {
      return await tryOnce();
    }
    throw err;
  }
}

// ============================================================================
// Location classification — one Claude Haiku call per song, classifies the
// reverse-geocode hints into one of 50 LocationType ids. See LOCATION_TYPES
// constant for the universe of values.
// ============================================================================

const LOCATION_TYPES_ALL: LocationType[] = [
  'home_interior', 'home_garden',
  'office', 'co_working_space',
  'factory_or_warehouse', 'construction_site',
  'retail_shop', 'shopping_mall', 'supermarket', 'outdoor_market',
  'cafe', 'restaurant', 'bar_or_pub', 'nightclub', 'fast_food', 'food_truck_or_street_food',
  'train_station', 'bus_station', 'airport', 'subway_or_metro', 'tunnel_or_underpass',
  'on_foot_street', 'highway_or_motorway', 'parking_lot_or_garage',
  'park_urban', 'plaza_or_public_square', 'rooftop', 'alleyway_or_back_street',
  'park_large_natural', 'forest_or_woods', 'mountain_or_hills',
  'beach_or_coast', 'river_or_lake', 'ocean_or_open_water',
  'desert_or_arid_land', 'field_or_meadow', 'cave_or_underground',
  'museum_or_gallery', 'library', 'theatre_or_cinema', 'concert_venue', 'stadium_or_arena',
  'gym_or_fitness',
  'school_or_university', 'hospital_or_clinic', 'government_building',
  'place_of_worship', 'historic_site',
  'rural_settlement', 'wilderness_or_remote',
];

const LOCATION_CLASSIFY_SYSTEM_PROMPT = `You classify a real-world place into ONE id from a fixed 50-option taxonomy.

Read the supplied reverse-geocode hints (Nominatim place/road/city, OSM category/type, nearby POIs) and reply with the SINGLE best-fit id. If genuinely ambiguous, prefer the broader/catch-all category (\`retail_shop\` for any small business, \`home_interior\` for any dwelling including hotels, \`on_foot_street\` for generic urban pedestrian). If no information is usable, reply \`unknown\`.

Reply with ONLY the id — no quotes, no punctuation, no commentary.

Valid ids:
${LOCATION_TYPES_ALL.join('\n')}
unknown`;

export interface ClassifyLocationInput {
  apiKey: string;
  /** The hints from the worker's reverseGeocode call. */
  geocode: {
    place?: { category: string; type: string; name?: string };
    road?: { class: string; name?: string };
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  /** Optional list of nearby POIs (also Nominatim shape) for disambiguation. */
  nearby?: Array<{ category: string; type: string; name?: string; distanceM: number }>;
}

export interface ClassifyLocationResult {
  locationType: LocationType;
  latencyMs: number;
  usage: { input_tokens: number; output_tokens: number };
}

export async function classifyLocation(
  input: ClassifyLocationInput,
): Promise<ClassifyLocationResult> {
  const payload = {
    geocode: input.geocode,
    ...(input.nearby && input.nearby.length > 0 ? { nearby: input.nearby.slice(0, 8) } : {}),
  };
  const userMessage = `Classify this location:\n${JSON.stringify(payload)}`;

  const requestBody = {
    model: MODEL,
    max_tokens: 40,
    temperature: 0,
    system: [
      {
        type: 'text',
        text: LOCATION_CLASSIFY_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user' as const, content: userMessage }],
  };

  const { data, latencyMs } = await callAnthropic(requestBody, input.apiKey);
  let text = '';
  for (const block of data.content ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') text += block.text;
  }
  const cleaned = text.trim().toLowerCase().replace(/[^a-z_]/g, '');
  const valid = new Set<string>([...LOCATION_TYPES_ALL, 'unknown']);
  const locationType: LocationType = valid.has(cleaned)
    ? (cleaned as LocationType)
    : 'unknown';

  return {
    locationType,
    latencyMs,
    usage: {
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

const TITLE_SYSTEM_PROMPT = `You are titling an episode of someone's life.
Read the timeline of signal changes, song characters, and the session's cosmic snapshot below, and produce a single title:
- 4-10 words
- evocative, slightly off-kilter
- no quotes, no period at the end
- the cosmic word is a flavoring hint, not a directive - feel free to use it, transform it, or ignore it
Return only the title.`;

export interface TitleInput {
  apiKey: string;
  timeline: unknown;
}

export async function generateTitle(input: TitleInput): Promise<string> {
  const requestBody = {
    model: MODEL,
    max_tokens: 60,
    temperature: 0.9,
    system: TITLE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: `Timeline: ${JSON.stringify(input.timeline)}`,
      },
    ],
  };
  const { data } = await callAnthropic(requestBody, input.apiKey);
  for (const block of data.content ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      return block.text.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
    }
  }
  throw new AnthropicError('title response had no text block');
}

export interface EvocativenessBatchInput {
  apiKey: string;
  words: string[];
}

const EVOCATIVE_SYSTEM_PROMPT = `Rate each given word for whether it is evocative and atmospheric, the kind of word that could direct a piece of music. Reply with one yes/no per word, in order, separated by commas, no explanation.

Reject words that are: proper nouns, brand names, slang, English idioms, tradition-specific symbols (tarot, runes, hexagrams, zodiac, religious or mythological referents), or clinical/technical jargon with no atmosphere.

Accept gerunds and verbs of motion or change (crossing, kindling, thawing), abstract nouns of state or quality (threshold, weight, hush), generic natural phenomena (updraft, tidewater, dry grass), and concrete neutrally-connotated objects (stone, lantern, drift, seam).`;

export async function rateEvocativenessBatch(input: EvocativenessBatchInput): Promise<boolean[]> {
  const requestBody = {
    model: MODEL,
    max_tokens: 200,
    temperature: 0,
    system: EVOCATIVE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        content: `Words (${input.words.length}): ${input.words.join(', ')}`,
      },
    ],
  };
  const { data } = await callAnthropic(requestBody, input.apiKey);
  let text = '';
  for (const block of data.content ?? []) {
    if (block?.type === 'text' && typeof block.text === 'string') {
      text += block.text;
    }
  }
  const tokens = text
    .toLowerCase()
    .split(/[,\s\n]+/)
    .map((t) => t.replace(/[^a-z]/g, ''))
    .filter((t) => t === 'yes' || t === 'no');
  if (tokens.length !== input.words.length) {
    return input.words.map((_, i) => tokens[i] === 'yes');
  }
  return tokens.map((t) => t === 'yes');
}
