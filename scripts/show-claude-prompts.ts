// One-off script: given a saved episode JSON (from KV), reconstruct exactly
// what Claude saw for each song (classifyLocation + composeSong prompts) and
// print it alongside the saved outputs Claude generated. Uses the same
// buildLexiconContext + buildClaudePromptJson code paths as the worker, so
// the user-message JSON matches what /generate actually sent.
//
// Usage: corepack pnpm exec tsx scripts/show-claude-prompts.ts /path/to/episode.json
import fs from 'node:fs';
// Relative imports so this script runs with a standalone tsx (no workspace
// resolution needed).
import {
  buildClaudePromptJson,
  COMPOSE_SYSTEM_PROMPT,
  LOCATION_CLASSIFY_SYSTEM_PROMPT,
} from '../packages/llm/src/index.ts';
import {
  buildLexiconContext,
  moonPhaseForDate,
} from '../packages/musical-schema/src/index.ts';
import type {
  BodyActivity,
  LexiconContextDict,
  LocationType,
  RenderPlan,
  SongRecord,
  StackedMeta,
} from '../packages/shared/src/index.ts';

interface EpisodeFile {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  songs: SongRecord[];
}

function topMoodTags(mood: Record<string, number>, k = 6, threshold = 0.1): string[] {
  return Object.entries(mood)
    .filter(([, w]) => w >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([tag]) => tag);
}

function divider(title: string): void {
  console.log('\n' + '═'.repeat(78));
  console.log('  ' + title);
  console.log('═'.repeat(78));
}

function subdivider(title: string): void {
  console.log('\n' + '─'.repeat(78));
  console.log('  ' + title);
  console.log('─'.repeat(78));
}

function showSong(song: SongRecord, idx: number, priorSongs: SongRecord[]): void {
  divider(`SONG ${idx + 1}  ${song.songId}`);

  const sv = song.stateVector;
  const stacked = song.stacked as StackedMeta;
  const renderPlan = song.renderPlan as RenderPlan;
  const locationType = (song.locationType ?? 'unknown') as LocationType;
  const bodyActivity = (song.bodyActivity ?? 'still') as BodyActivity;

  // Mirror SongSynthesizer's `recentHistory`: last 3 played songs, metadata
  // plus measuredFeatures if present. For song N, this contains songs 1..N-1.
  const recentHistory = priorSongs.slice(-3).map((s) => ({
    songId: s.songId,
    metadata: s.metadata,
    ...(s.measuredFeatures ? { measuredFeatures: s.measuredFeatures } : {}),
  }));

  // ============================
  // STEP 1: classifyLocation
  // ============================
  subdivider('STEP 1 · classifyLocation — system prompt');
  console.log(LOCATION_CLASSIFY_SYSTEM_PROMPT);

  const classifyPayload = {
    geocode: {
      ...(sv.location?.place ? { place: sv.location.place } : {}),
      ...(sv.location?.road ? { road: sv.location.road } : {}),
      ...(sv.location?.neighborhood ? { neighborhood: sv.location.neighborhood } : {}),
      ...(sv.location?.city ? { city: sv.location.city } : {}),
      ...(sv.location?.state ? { state: sv.location.state } : {}),
      ...(sv.location?.country ? { country: sv.location.country } : {}),
    },
    ...(sv.location?.nearby ? { nearby: sv.location.nearby.slice(0, 8) } : {}),
  };
  subdivider('STEP 1 · classifyLocation — user message');
  console.log(`Classify this location:\n${JSON.stringify(classifyPayload, null, 2)}`);

  subdivider('STEP 1 · classifyLocation — OUTPUT (what Claude actually returned)');
  console.log(locationType);

  // ============================
  // STEP 2: composeSong
  // ============================
  subdivider('STEP 2 · composeSong — system prompt (truncated)');
  console.log(COMPOSE_SYSTEM_PROMPT.slice(0, 600) + '\n...[truncated]\n');

  const activeMoods = topMoodTags(stacked.mood, 6, 0.1);
  const worldIds: string[] = [stacked.inspiration.world];
  if (stacked.inspiration.worldSecondary) worldIds.push(stacked.inspiration.worldSecondary);
  const lexicon: LexiconContextDict = buildLexiconContext({
    timePhase: stacked.timePhase,
    weatherCondition: stacked.weatherCondition,
    moonPhase: stacked.moonPhase,
    dayOfWeek: sv.time.dayOfWeek,
    bodyActivity,
    ...(locationType !== 'unknown' ? { locationType } : {}),
    activeMoodTags: activeMoods,
    textureKeys: stacked.inspiration.textureKeys,
    worldIds,
  });

  const moonPhase = moonPhaseForDate(new Date(sv.timestamp));
  const promptJson = buildClaudePromptJson({
    stateVector: sv,
    moonPhase,
    stacked,
    renderPlan,
    lexicon,
    ...(locationType !== 'unknown' ? { locationType } : {}),
    vibes: song.phraseOfTheMoment ? { phraseOfTheMoment: song.phraseOfTheMoment.phrase } : {},
    recentHistory,
  });

  subdivider('STEP 2 · composeSong — user message (full JSON sent to Claude)');
  console.log(JSON.stringify(promptJson, null, 2));

  subdivider('STEP 2 · composeSong — OUTPUT.metadata (what Claude returned)');
  console.log(JSON.stringify(song.metadata, null, 2));

  subdivider('STEP 2 · composeSong — OUTPUT.composition (what Claude returned)');
  console.log(JSON.stringify(song.composition, null, 2));
}

function main(): void {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: tsx scripts/show-claude-prompts.ts <episode.json>');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(path, 'utf-8')) as EpisodeFile;
  console.log(`Episode ${data.sessionId}`);
  console.log(`  startedAt: ${data.startedAt}`);
  console.log(`  endedAt:   ${data.endedAt ?? '-'}`);
  console.log(`  songs:     ${data.songs.length}`);
  data.songs.forEach((song, i) => showSong(song, i, data.songs.slice(0, i)));
}

main();
