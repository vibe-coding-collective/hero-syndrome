import type { Composition } from '@hero-syndrome/shared';

const ELEVENLABS_MUSIC_URL = 'https://api.elevenlabs.io/v1/music';

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'ElevenLabsError';
  }
}

export interface RenderCompositionInput {
  apiKey: string;
  composition: Composition;
  signal?: AbortSignal;
}

export interface RenderCompositionResult {
  audio: ArrayBuffer;
  contentType: string;
  durationSec: number;
  latencyToFirstByteMs: number;
  totalLatencyMs: number;
}

const TARGET_CLIP_SEC = 60;

function compositionToCompositionPlan(c: Composition) {
  // Rescale section durations so the total is exactly TARGET_CLIP_SEC. The
  // Claude tool schema constrains each section to 15-60s and limits the
  // sections array to 1-2 entries, but the model can still emit a sum that
  // drifts from 60s; rescaling proportionally preserves the model's intent
  // while pinning the clip length the audio engine expects.
  const rawTotal = c.sections.reduce((acc, s) => acc + s.durationSec, 0);
  const scale = rawTotal > 0 ? TARGET_CLIP_SEC / rawTotal : 1;
  return {
    positive_global_styles: [c.overallPrompt],
    negative_global_styles: [
      'lyrics',
      'vocals',
      'singing',
      'spoken word',
      'rap',
    ],
    sections: c.sections.map((s) => ({
      section_name: s.label,
      duration_ms: Math.round(s.durationSec * scale * 1000),
      positive_local_styles: [s.prompt],
      negative_local_styles: ['lyrics', 'vocals'],
      lines: [],
    })),
  };
}

export async function renderComposition(input: RenderCompositionInput): Promise<RenderCompositionResult> {
  const start = Date.now();
  const compositionPlan = compositionToCompositionPlan(input.composition);
  const totalDurationSec = input.composition.sections.reduce((acc, s) => acc + s.durationSec, 0);
  const url = `${ELEVENLABS_MUSIC_URL}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': input.apiKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      composition_plan: compositionPlan,
      output_format: 'mp3_44100_128',
      // Let ElevenLabs adjust section boundaries within the total duration;
      // improves latency and quality on short clips per the API docs.
      respect_sections_durations: false,
    }),
    signal: input.signal,
  });
  const latencyToFirstByteMs = Date.now() - start;
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new ElevenLabsError(
      `ElevenLabs Music request failed (${res.status})`,
      res.status,
      text,
    );
  }
  // R2 PUT needs a known length, and ElevenLabs streams without
  // Content-Length, so buffer the full audio. A 3-6 min mp3 at 128 kbps
  // sits at ~3-6 MB — well within Worker memory.
  const audio = await res.arrayBuffer();
  return {
    audio,
    contentType: res.headers.get('content-type') ?? 'audio/mpeg',
    durationSec: totalDurationSec,
    latencyToFirstByteMs,
    totalLatencyMs: Date.now() - start,
  };
}

export async function renderCompositionWithRetry(
  input: RenderCompositionInput,
): Promise<RenderCompositionResult> {
  try {
    return await renderComposition(input);
  } catch (err) {
    if (err instanceof ElevenLabsError && err.status && err.status >= 500) {
      return await renderComposition(input);
    }
    throw err;
  }
}
