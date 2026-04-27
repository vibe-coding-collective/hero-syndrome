import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

export const PATHS = {
  repoRoot,
  vocabData: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data'),
  effRaw: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'eff-words-raw.txt'),
  effWords: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'eff-words.json'),
  evocativeness: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'evocativeness.json'),
  approvedPool: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'approved-pool.json'),
  embeddings: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'approved-pool-embeddings.json'),
  projection: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'projection.json'),
  fluxStats: path.join(repoRoot, 'packages', 'cosmic-vocab', 'data', 'flux-stats.json'),
};
