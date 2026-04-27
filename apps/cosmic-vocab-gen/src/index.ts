import fs from 'node:fs/promises';
import process from 'node:process';
import { downloadEffWords } from './downloadEffList';
import { filterEvocative } from './filterEvocative';
import { embedWordsViaWorker } from './computeEmbeddings';
import { generateProjection } from './generateProjection';
import { computeFluxStats } from './computeFluxStats';
import { PATHS } from './paths';
import { log } from './log';

const POOL_CAP = parseInt(process.env.POOL_CAP ?? '1024', 10);

async function main(): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const workerUrl = process.env.WORKER_URL;
  const devToken = process.env.DEV_TOKEN;
  const userAgent = process.env.USER_AGENT ?? 'HeroSyndrome/0.1 (cosmic-vocab-gen; contact: danporder@gmail.com)';

  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is required');
  if (!workerUrl) throw new Error('WORKER_URL is required (deployed worker base URL, no trailing slash)');
  if (!devToken) throw new Error('DEV_TOKEN is required (matches the worker secret)');

  log('Stage 1: download EFF Long Word List');
  const effWords = await downloadEffWords();

  log('Stage 2: evocativeness filter (Claude Haiku, batches of 50)');
  const yesWords = await filterEvocative(effWords, anthropicKey);

  const today = new Date().toISOString().slice(0, 10);
  const pool = yesWords.slice(0, POOL_CAP);
  log(`Pool capped at ${pool.length} (POOL_CAP=${POOL_CAP})`);
  const poolDoc = { version: `v1.${today}`, words: pool };
  await fs.writeFile(PATHS.approvedPool, JSON.stringify(poolDoc), 'utf8');

  log('Stage 3: compute embeddings via Workers AI (bge-small-en-v1.5)');
  const emb = await embedWordsViaWorker({ workerUrl, devToken, words: pool });
  await fs.writeFile(
    PATHS.embeddings,
    JSON.stringify({
      version: poolDoc.version,
      dim: emb.dim,
      quantized: false,
      embeddings: emb.embeddings,
    }),
    'utf8',
  );
  log(`Embeddings written: ${emb.embeddings.length} × ${emb.dim}`);

  log('Stage 4: generate projection matrix (deterministic seed)');
  const projection = generateProjection(13, 384, 42);
  await fs.writeFile(PATHS.projection, JSON.stringify(projection), 'utf8');

  log('Stage 5: compute flux stats from last 7 days of GOES proton data');
  const flux = await computeFluxStats(userAgent);
  await fs.writeFile(PATHS.fluxStats, JSON.stringify(flux), 'utf8');

  log('Done. Worker must be redeployed to pick up the new cosmic-vocab data.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
