import fs from 'node:fs/promises';
import process from 'node:process';
import { ALL_SOURCES, combinePool } from './sources';
import { embedWordsViaWorker, quantizeToBase64 } from './computeEmbeddings';
import { generateProjection } from './generateProjection';
import { computeSpaceWeatherStats } from './computeSpaceWeatherStats';
import { PATHS } from './paths';
import { log } from './log';

async function main(): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  const devToken = process.env.DEV_TOKEN;
  const userAgent =
    process.env.USER_AGENT ?? 'HeroSyndrome/0.1 (material-force-vocab-gen; contact: danporder@gmail.com)';
  const skipEmbeddings = !workerUrl || !devToken;

  log(`Stage 1: combine ${ALL_SOURCES.length} source contributions`);
  const material = combinePool('material', ALL_SOURCES);
  const force = combinePool('force', ALL_SOURCES);
  log(`  material pool: ${material.words.length} unique words`);
  log(`  force pool:    ${force.words.length} unique words`);

  const today = new Date().toISOString().slice(0, 10);
  const poolVersion = `seed.${today}`;

  await fs.writeFile(
    PATHS.materialPool,
    JSON.stringify(
      { version: poolVersion, words: material.words, sources: material.sources },
      null,
      0,
    ),
    'utf8',
  );
  await fs.writeFile(
    PATHS.forcePool,
    JSON.stringify(
      { version: poolVersion, words: force.words, sources: force.sources },
      null,
      0,
    ),
    'utf8',
  );
  log(`  wrote pool files (version ${poolVersion})`);

  log('Stage 2: generate 3×384 random projection (deterministic seed)');
  const projection = generateProjection(384, 137);
  await fs.writeFile(PATHS.projection, JSON.stringify(projection), 'utf8');
  log(`  wrote ${PATHS.projection} (${projection.values.length} values)`);

  log('Stage 3: compute space-weather stats from NOAA SWPC');
  try {
    const stats = await computeSpaceWeatherStats(userAgent);
    await fs.writeFile(PATHS.spaceWeatherStats, JSON.stringify(stats), 'utf8');
    log(
      `  wrote ${PATHS.spaceWeatherStats} (k μ=${stats.kIndexMean.toFixed(2)} σ=${stats.kIndexStddev.toFixed(2)}, ` +
        `wind μ=${stats.solarWindSpeedMean.toFixed(0)} σ=${stats.solarWindSpeedStddev.toFixed(0)}, ` +
        `density μ=${stats.solarWindDensityMean.toFixed(2)} σ=${stats.solarWindDensityStddev.toFixed(2)})`,
    );
  } catch (err) {
    log(`  WARN: space-weather stats fetch failed (${String(err)}); leaving existing file in place`);
  }

  if (skipEmbeddings) {
    log('Stage 4: SKIPPED — set WORKER_URL and DEV_TOKEN to compute embeddings.');
    log('Done. Worker bundle will treat pools as ready once embeddings are populated.');
    return;
  }

  log('Stage 4: compute embeddings via worker /admin/embed (bge-small-en-v1.5)');
  const matEmb = await embedWordsViaWorker({
    workerUrl,
    devToken,
    words: material.words,
    label: 'material',
  });
  await fs.writeFile(
    PATHS.materialEmbeddings,
    JSON.stringify(quantizeToBase64(matEmb, poolVersion)),
    'utf8',
  );
  log(`  material embeddings: ${matEmb.embeddings.length} × ${matEmb.dim}`);

  const forceEmb = await embedWordsViaWorker({
    workerUrl,
    devToken,
    words: force.words,
    label: 'force',
  });
  await fs.writeFile(
    PATHS.forceEmbeddings,
    JSON.stringify(quantizeToBase64(forceEmb, poolVersion)),
    'utf8',
  );
  log(`  force embeddings:    ${forceEmb.embeddings.length} × ${forceEmb.dim}`);

  log('Done. Worker must be redeployed to pick up the new material/force vocab data.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
