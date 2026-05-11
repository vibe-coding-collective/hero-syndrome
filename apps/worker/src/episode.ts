import { ulid } from 'ulid';
import type { EpisodeRecord, FinalizeRes, SessionRecord } from '@hero-syndrome/shared';
import { generateTitle, AnthropicError } from '@hero-syndrome/llm';
import { writeEpisode } from './kv';
import { episodeSongKey, copyObject, sessionSongKey } from './r2';
import type { Env } from './types';

export async function finalizeSession(
  env: Env,
  session: SessionRecord,
): Promise<{ result: FinalizeRes; episode: EpisodeRecord }> {
  const episodeId = ulid();
  let title = '';
  const timeline = buildTimeline(session);
  try {
    title = await generateTitle({ apiKey: env.ANTHROPIC_API_KEY, timeline });
  } catch (err) {
    if (err instanceof AnthropicError) {
      const phase = session.songs[0]?.stateVector.time.phase ?? 'unknown';
      const loc = session.songs[0]?.locationType ?? 'somewhere';
      title = `An episode at ${phase} in a ${loc} place`;
    } else throw err;
  }

  const totalBytesConsumed = session.songs.reduce(
    (acc, s) => acc + (s.quantumBytes?.bytes?.length ?? 0),
    0,
  );
  const sources = session.songs.map((s) => s.quantumBytes.source);
  const overallSource: EpisodeRecord['quantumReceipt']['source'] = sources.includes('pseudo')
    ? 'pseudo'
    : sources.includes('mixed')
      ? 'mixed'
      : 'qrng';

  const episode: EpisodeRecord = {
    ...session,
    episodeId,
    title,
    quantumReceipt: { totalBytesConsumed, source: overallSource },
  };

  await Promise.all(
    session.songs.map((song) =>
      copyObject(env, sessionSongKey(session.sessionId, song.songId), episodeSongKey(episodeId, song.songId)).catch(
        () => undefined,
      ),
    ),
  );

  await writeEpisode(env, episode);

  return {
    result: { episodeId, shareUrl: `/episode/${episodeId}` },
    episode,
  };
}

function buildTimeline(session: SessionRecord): unknown {
  return {
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    cosmic: session.cosmic,
    songs: session.songs.map((s) => ({
      songId: s.songId,
      startedAt: s.startedAt,
      durationSec: s.durationSec,
      metadata: s.metadata,
      measuredFeatures: s.measuredFeatures,
      locationType: s.locationType,
      condition: s.stateVector.weather?.condition,
      phase: s.stateVector.time.phase,
      bodyActivity: s.bodyActivity,
      phraseOfTheMoment: s.phraseOfTheMoment?.phrase,
    })),
  };
}
