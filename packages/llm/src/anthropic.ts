import type {
  ClaudePromptJson,
  Composition,
  SongMetadata,
} from '@hero-syndrome/shared';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

const COMPOSE_SYSTEM_PROMPT = `You are composing a film score for this person's life, one song at a time, by calling the \`compose_song\` tool exactly once per turn.

Each user message has two sections separated by Markdown headers:

1. **\`# Musical scaffolding\`** — the deterministic musical picks (tempo, key, instrumentation base, day accent, weather-driven timbres, reverb, dynamics, articulation, phrase shape, threshold accents) chosen for this song from a quantum-driven schema. One line per element. Honor every line. Treat the scaffolding as a constellation, not a recipe — you choose section count, transitions, intros/outros, modal flavoring within the chosen key, and the dynamic arc within the dynamic range.

2. **\`# Present moment\`** — a JSON object describing the world state right now. Use it to color prose and intent, never to override the scaffolding.

The JSON object's keys:
- \`state\`: \`time\`, \`body\` (activity, motion, intensity), \`location\` (\`placeType\` bucket, \`place.type\` raw OSM kind, \`place.name\` proper name when one exists, \`city\`, \`country\`, \`nearby\` points of interest), and \`weather\`.
- \`userInput\`: direct inputs the listener has placed on the score (currently always empty).
- \`vibes\`: distillations of the moment.
  - \`wordOfTheMoment\`: a single word drawn today from particle-radiation flux, projected into a daily-rotated vocabulary.
  - \`phraseOfTheMoment\`: a two-part phrase (a material and a force, e.g. "humming copper wire") drawn from open texts and conditioned on current space weather.
- \`recentHistory\`: the previous few songs as \`{ metadata, measuredFeatures? }\`. \`measuredFeatures\` reflects what the audio actually sounded like; trust it over \`metadata\` when they disagree.

The \`compose_song\` tool returns:
- \`metadata\`: BPM range, key, intensity, instrumentation, genre tags, and \`transitionIntent\` (\`continue\` | \`evolve\` | \`shift\` | \`break\`). For downstream continuity; the music engine never sees it.
- \`composition\`: the plan sent verbatim to the music engine. An \`overallPrompt\` and 1–30 sections (each 3–120 s, summing to 3 s–10 min). Section prompts must explicitly embed the metadata values — BPM (or a narrow range), key/mode, lead instrumentation, and intensity descriptor — so metadata and section prompts agree.

Instrumental only — no lyrics, no vocal lines.`;

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
            description: '[low, high] BPM, e.g. [60, 72]',
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
            maxItems: 30,
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                durationSec: { type: 'number', minimum: 3, maximum: 120 },
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
  /** Pre-built JSON to embed verbatim in the user message. Built by
   *  `buildClaudePromptJson` from the raw state, cosmic snapshot, and
   *  recent history. */
  promptJson: ClaudePromptJson;
  /** Optional directorial block — paragraph prose that lists the
   *  quantum-driven musical-schema picks for this song. Appended after the
   *  JSON in the user message. */
  directorialBlock?: string;
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
  const jsonPart = JSON.stringify(input.promptJson, null, 2);
  const userMessage = input.directorialBlock
    ? `${input.directorialBlock}\n\n# Present moment\n\n${jsonPart}`
    : jsonPart;

  const requestBody = {
    model: MODEL,
    // Effectively unlimited (Haiku 4.5 ceiling). The API requires the field
    // but we never want output truncation here — it silently corrupts the
    // tool-call JSON.
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

const TITLE_SYSTEM_PROMPT = `You are titling an episode of someone's life.
Read the timeline of signal changes, stickers, song characters, and the session's cosmic snapshot below, and produce a single title:
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
