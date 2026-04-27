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
  body: ReadableStream<Uint8Array>;
  contentType: string;
  durationSec: number;
  latencyToFirstByteMs: number;
}

function compositionToCompositionPlan(c: Composition) {
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
      duration_ms: Math.round(s.durationSec * 1000),
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
  return {
    body: res.body,
    contentType: res.headers.get('content-type') ?? 'audio/mpeg',
    durationSec: totalDurationSec,
    latencyToFirstByteMs,
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
