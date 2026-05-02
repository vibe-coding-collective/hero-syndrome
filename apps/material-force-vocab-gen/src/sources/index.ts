import { beeton } from './beeton';
import { blacksmithing } from './blacksmithing';
import { cockerell } from './cockerell';
import { colorOfArt } from './colorOfArt';
import { cooperHewitt } from './cooperHewitt';
import { gnis } from './gnis';
import { oelsner } from './oelsner';
import { rruff } from './rruff';
import { silkRoad } from './silkRoad';
import { usgsGlossary } from './usgsGlossary';
import { wellcome } from './wellcome';
import type { SourceContribution } from './types';

export const ALL_SOURCES: SourceContribution[] = [
  rruff,
  colorOfArt,
  cooperHewitt,
  silkRoad,
  gnis,
  beeton,
  blacksmithing,
  wellcome,
  oelsner,
  cockerell,
  usgsGlossary,
];

export type { SourceContribution };

export interface CombinedPool {
  /** Lowercase, deduped, sorted alphabetically. */
  words: string[];
  /** Parallel to `words`. Each entry is the comma-joined sourceKey list of
   *  every source that contributed that word. */
  sources: string[];
}

export function combinePool(
  pool: 'material' | 'force',
  contributions: SourceContribution[],
): CombinedPool {
  const map = new Map<string, Set<string>>();
  for (const c of contributions) {
    if (c.pool !== pool) continue;
    for (const raw of c.words) {
      const w = raw.trim().toLowerCase();
      if (!w) continue;
      if (!map.has(w)) map.set(w, new Set());
      map.get(w)!.add(c.sourceKey);
    }
  }
  const words = [...map.keys()].sort();
  const sources = words.map((w) => [...map.get(w)!].sort().join(','));
  return { words, sources };
}
