import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PATHS } from './paths';
import { log } from './log';

const EFF_URL = 'https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt';

export async function downloadEffWords(): Promise<string[]> {
  if (existsSync(PATHS.effWords)) {
    const data = JSON.parse(await fs.readFile(PATHS.effWords, 'utf8')) as string[];
    log(`EFF words already on disk: ${data.length} words`);
    return data;
  }
  await fs.mkdir(PATHS.vocabData, { recursive: true });
  let raw: string;
  if (existsSync(PATHS.effRaw)) {
    raw = await fs.readFile(PATHS.effRaw, 'utf8');
    log(`Reusing cached EFF raw at ${PATHS.effRaw}`);
  } else {
    log(`Downloading EFF Long Word List from ${EFF_URL}`);
    const res = await fetch(EFF_URL);
    if (!res.ok) throw new Error(`EFF download failed (${res.status})`);
    raw = await res.text();
    await fs.writeFile(PATHS.effRaw, raw, 'utf8');
  }
  const words = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      return parts[parts.length - 1] ?? '';
    })
    .filter((w) => /^[a-z]+$/.test(w));
  await fs.writeFile(PATHS.effWords, JSON.stringify(words), 'utf8');
  log(`EFF words written: ${words.length}`);
  return words;
}
