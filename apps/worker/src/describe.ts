import { describeSong } from '@hero-syndrome/llm';
import type { SongRecord } from '@hero-syndrome/shared';
import type { Env } from './types';

/** Hard ceiling on description length before we ellipsize. Matches the body
 *  line-clamp in the closed drawer (~4 lines at the rendered font size) so
 *  the visible peek doesn't truncate mid-word. */
const DESCRIPTION_CHAR_LIMIT = 240;

export interface DescribeResult {
  title: string;
  description: string;
  latencyMs: number;
}

/** Calls Claude to generate a title + description for a song. The title is
 *  auto-uppercased; the description is hard-capped at DESCRIPTION_CHAR_LIMIT
 *  with an ellipsis. Both transforms happen here so every consumer (client
 *  drawer, finalized episode pages, share previews) gets the same shape. */
export async function runDescribe(env: Env, song: SongRecord): Promise<DescribeResult> {
  const start = Date.now();

  const raw = await describeSong({
    apiKey: env.ANTHROPIC_API_KEY,
    context: {
      stateVector: song.stateVector,
      metadata: song.metadata,
      composition: song.composition,
      ...(song.phraseOfTheMoment ? { phraseOfTheMoment: song.phraseOfTheMoment } : {}),
      ...(song.stacked ? { stacked: song.stacked } : {}),
    },
  });

  const title = raw.title.toUpperCase();
  const description = capWithEllipsis(raw.description, DESCRIPTION_CHAR_LIMIT);

  return { title, description, latencyMs: Date.now() - start };
}

function capWithEllipsis(input: string, limit: number): string {
  const trimmed = input.trim();
  if (trimmed.length <= limit) return trimmed;
  // Leave one character of headroom for the ellipsis (… is a single codepoint
  // but renders as 3 visual dots — we still want to honor the rendered limit).
  const sliced = trimmed.slice(0, limit - 1).trimEnd();
  // Avoid ending on a comma or open punctuation; back up to the last whole
  // word so the ellipsis lands somewhere readable.
  const lastSpace = sliced.lastIndexOf(' ');
  const body = lastSpace > limit * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${body.replace(/[,;:\s]+$/, '')}…`;
}
