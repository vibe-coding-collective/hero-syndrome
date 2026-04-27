import type {
  Composition,
  SongMetadata,
  StateVector,
  Sticker,
  CosmicSnapshot,
  QuantumBytes,
  MeasuredFeatures,
} from '@hero-syndrome/shared';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';

const COMPOSE_SYSTEM_PROMPT = `You are the music director for a film of this person's life. You program the score one song at a time, reading the current state of the person's world, any emoji "mood stickers" they've placed, and the recent few songs already in the playlist. Each song is a complete piece (~3-6 min) composed from a sequence of sections.

You must call the \`compose_song\` tool exactly once. Its input has two parts:

  metadata:    a label of the song's musical character (BPM range, key, intensity, instrumentation, genre tags, transitionIntent). This is for downstream continuity; ElevenLabs never sees it.

  composition: the structured plan sent verbatim to ElevenLabs Music as its composition_plan. Contains an overallPrompt and 1-30 sections (each 3-120 s, summing to 3 s-10 min total). Each section has a label, durationSec, and a section-level prompt. Section prompts MUST explicitly embed the metadata values - state BPM (or narrow range), key/mode, lead instrumentation, and intensity descriptor in the prose. Metadata and section prompts must agree.

CURATION RULES (this is a playlist, not a stitched stream):
- Use \`recentHistory\` (last 3 songs' metadata + measuredFeatures) as your curation context. measuredFeatures is what the rendered audio actually sounded like - trust it more than metadata when they disagree.
- Each song must have its own character - do not repeat prior compositions or metadata values verbatim. Vary key, instrumentation, and structure.
- Pick \`transitionIntent\` based on how state and stickers have changed:
    continue - same vibe, slight variation (sustained context, no sticker)
    evolve   - related, moving forward thematically (gradual state drift)
    shift    - intentional pivot to a new mood (significant state change)
    break    - hard contrast (fresh sticker spike, or major state change like motionClass: still -> running, or weather: clear -> storm)
- Songs are full compositions: design intentional intros and outros so back-to-back playback feels like a curated set, not a hard cut.
- Instrumental only - no lyrics, no vocal lines.
- Prefer specific over abstract. Cinematic but never obvious. Avoid cliches.

RANDOMNESS:
The \`quantum_bytes\` array is your source of any small stochastic choice. Each byte is uniform on 0..255. Use them in order. When you would otherwise rely on internal randomness - picking a BPM inside a range, choosing a key from several plausible options, deciding which instrument leads, choosing the section count, picking modal flavor - sample from \`quantum_bytes\` instead. Map them to choices via modular arithmetic or threshold tests as appropriate. The bytes are not part of the composition's text. They are the substrate of its small choices. This is a philosophical commitment of the piece. Honor it.`;

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
  stateVector: StateVector;
  stickers: Sticker[];
  cosmic?: CosmicSnapshot;
  quantumBytes: QuantumBytes;
  recentHistory: Array<{
    songId: string;
    metadata: SongMetadata;
    measuredFeatures?: MeasuredFeatures;
  }>;
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
  const userMessage = [
    `State: ${JSON.stringify(input.stateVector)}`,
    `Active stickers: ${JSON.stringify(input.stickers)}`,
    `Cosmic snapshot: ${JSON.stringify(input.cosmic ?? null)}`,
    `Quantum bytes: ${JSON.stringify(input.quantumBytes.bytes)} (source: ${input.quantumBytes.source})`,
    `Recent history (most recent last): ${JSON.stringify(input.recentHistory)}`,
  ].join('\n');

  const requestBody = {
    model: MODEL,
    // Claude Haiku produces ~750-1000 output tokens for a full composition_plan.
    // Tight ceilings truncate `composition` mid-tool-call (stop_reason="max_tokens").
    max_tokens: 2000,
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
