import type { Sticker } from '@hero-syndrome/shared';

export function decayProgress(s: Sticker, now: number = Date.now()): number {
  const placed = new Date(s.placedAt).getTime();
  const decayAt = new Date(s.decayAt).getTime();
  if (decayAt <= placed) return 1;
  const t = (now - placed) / (decayAt - placed);
  return Math.max(0, Math.min(1, t));
}

export function decayOpacity(s: Sticker, now: number = Date.now()): number {
  return Math.max(0, 1 - decayProgress(s, now));
}

export function decayScale(s: Sticker, now: number = Date.now()): number {
  return 0.55 + 0.45 * (1 - decayProgress(s, now));
}
