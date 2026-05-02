import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

const dataDir = path.join(repoRoot, 'packages', 'material-force-vocab', 'data');

export const PATHS = {
  repoRoot,
  dataDir,
  rawDir: path.join(dataDir, 'raw'),
  materialPool: path.join(dataDir, 'material-pool.json'),
  materialEmbeddings: path.join(dataDir, 'material-pool-embeddings.json'),
  forcePool: path.join(dataDir, 'force-pool.json'),
  forceEmbeddings: path.join(dataDir, 'force-pool-embeddings.json'),
  projection: path.join(dataDir, 'projection.json'),
  spaceWeatherStats: path.join(dataDir, 'spaceweather-stats.json'),
};
