// MVP stub: generation of the 25-prelude bank is deferred. This script
// produces an empty manifest that the runtime accepts gracefully. When the
// real bank is generated, this CLI will iterate the 25 buckets, call the
// shared LLM + ElevenLabs Music pipeline with single-section composition
// plans (~30-60 s), upload audio to R2, and write the full manifest.
//
// Run: WORKER_URL=https://hero-syndrome-worker.<account>.workers.dev \
//      DEV_TOKEN=<secret> \
//      pnpm preludes:gen
//
// Behavior right now:
//   - Builds an empty manifest object
//   - Prints it to stdout
//   - Does NOT upload anything

import process from 'node:process';
import type { PreludeManifest } from '@hero-syndrome/shared';
import { BUCKET_IDS } from './buckets';

function buildEmptyManifest(): PreludeManifest {
  return { version: `stub.${new Date().toISOString().slice(0, 10)}`, preludes: [] };
}

async function main(): Promise<void> {
  const manifest = buildEmptyManifest();
  console.log('Prelude bank stub. Buckets that will be generated when this CLI is fleshed out:');
  for (const id of BUCKET_IDS) console.log(`  - ${id}`);
  console.log('');
  console.log('Empty manifest:');
  console.log(JSON.stringify(manifest, null, 2));
  console.log('');
  console.log('To deploy the empty manifest, upload it to R2 manually:');
  console.log('  echo \'<json>\' | wrangler r2 object put hero-syndrome-audio/preludes/manifest.json --pipe');
  console.log('');
  console.log('Or skip — the worker returns an empty manifest if R2 has none.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
