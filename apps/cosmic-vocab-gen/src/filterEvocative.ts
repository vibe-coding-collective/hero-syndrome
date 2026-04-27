import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { rateEvocativenessBatch } from '@hero-syndrome/llm';
import { PATHS } from './paths';
import { log } from './log';

const BATCH_SIZE = 50;

interface Evocativeness {
  ratings: Record<string, boolean>;
}

export async function filterEvocative(words: string[], apiKey: string): Promise<string[]> {
  let cache: Evocativeness;
  if (existsSync(PATHS.evocativeness)) {
    cache = JSON.parse(await fs.readFile(PATHS.evocativeness, 'utf8')) as Evocativeness;
  } else {
    cache = { ratings: {} };
  }

  const todo = words.filter((w) => !(w in cache.ratings));
  log(`Evocativeness: ${words.length} total, ${todo.length} new to rate`);
  for (let i = 0; i < todo.length; i += BATCH_SIZE) {
    const batch = todo.slice(i, i + BATCH_SIZE);
    try {
      const ratings = await rateEvocativenessBatch({ apiKey, words: batch });
      for (let j = 0; j < batch.length; j++) {
        cache.ratings[batch[j]!] = ratings[j] ?? false;
      }
    } catch (err) {
      log(`Batch error: ${String(err)} (skipping)`);
      for (const w of batch) cache.ratings[w] = false;
    }
    if ((i / BATCH_SIZE) % 5 === 0) {
      await fs.writeFile(PATHS.evocativeness, JSON.stringify(cache), 'utf8');
    }
    if (i % (BATCH_SIZE * 10) === 0) {
      const done = i + batch.length;
      log(`  rated ${done}/${todo.length}`);
    }
  }
  await fs.writeFile(PATHS.evocativeness, JSON.stringify(cache), 'utf8');

  const yesWords = words.filter((w) => cache.ratings[w] === true);
  log(`Evocativeness: ${yesWords.length}/${words.length} marked yes`);
  return yesWords;
}
