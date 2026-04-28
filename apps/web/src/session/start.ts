import { ulid } from 'ulid';
import { api, preludeUrl } from '../api/client';
import { AudioEngine } from '../audio/engine';
import { AudioFeatureExtractor } from '../audio/audioFeatures';
import { setMediaSessionMetadata, setMediaSessionPlaybackState } from '../audio/mediaSession';
import { GeolocationSensor } from '../sensors/geolocation';
import { MotionSensor } from '../sensors/motion';
import { readClock } from '../sensors/clock';
import { StateAggregator } from '../state/aggregator';
import { SongSynthesizer } from '../state/songSynthesizer';
import { loadPreludesManifest, pickPrelude } from '../prelude/manifest';
import { useStore, type PlayedSong } from '../state/store';

export interface SceneRuntime {
  engine: AudioEngine;
  synthesizer: SongSynthesizer;
  motion: MotionSensor;
  geolocation: GeolocationSensor;
  aggregator: StateAggregator;
  features: AudioFeatureExtractor;
  detach: () => void;
  scheduleFinalize: () => void;
}

let active: SceneRuntime | null = null;

export function getActiveRuntime(): SceneRuntime | null {
  return active;
}

export async function startScene(audioCtx?: AudioContext): Promise<SceneRuntime> {
  const sessionId = ulid();
  const startedAt = Date.now();
  useStore.getState().resetSession();
  useStore.getState().setSession({ sessionId, startedAt });

  const motion = new MotionSensor();
  const motionGranted = await motion.requestPermission();
  motion.start();
  const geolocation = new GeolocationSensor();
  geolocation.start();

  let geoGranted = false;
  if ('permissions' in navigator) {
    try {
      const status = await (navigator.permissions as Permissions).query({ name: 'geolocation' as PermissionName });
      geoGranted = status.state === 'granted';
    } catch { /* ignore */ }
  }
  if (!geoGranted) {
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(() => resolve(), () => reject(), { enableHighAccuracy: false, timeout: 10_000 });
      });
      geoGranted = true;
    } catch { /* user denied; degrade gracefully */ }
  }
  useStore.getState().setSensors({ permissionsGranted: { motion: motionGranted, geolocation: geoGranted } });

  const engine = new AudioEngine({}, audioCtx);
  const features = new AudioFeatureExtractor(engine.analyser);
  const aggregator = new StateAggregator(motion, geolocation);
  aggregator.start();

  // Fetch frozen cosmic snapshot in parallel; non-blocking
  api.cosmicGlobal().then((cosmic) => useStore.getState().setSession({ cosmic })).catch(() => undefined);

  const synthesizer = new SongSynthesizer(engine);

  let measuredSampleStartedAt = 0;
  engine.setEvents({
    onSongStart: (songId, startedAtMs, durationSec) => {
      useStore.getState().setPlayback({ isPlaying: true, currentSongId: songId });
      useStore.getState().setSongStarted(songId, startedAtMs);
      setMediaSessionMetadata({ title: 'Hero Syndrome — current scene' });
      setMediaSessionPlaybackState('playing');
      // Restart feature extractor for the new song
      features.finish();
      features.begin(durationSec);
      measuredSampleStartedAt = performance.now();
      // Once we have ~10s of audio measured, send measuredFeatures to server
      window.setTimeout(() => {
        const f = features.estimate();
        const sid = useStore.getState().sessionId;
        if (f && sid) {
          api.recordMeasured(sid, { songId, features: f }).catch(() => undefined);
          useStore.getState().setSongMeasured(songId, f);
        }
      }, 12_000);
    },
    onNeedNext: () => {
      synthesizer.generateNext().catch(() => undefined);
    },
    onTailLoopExpired: () => {
      synthesizer.generateNext().catch(() => undefined);
    },
    onAllEnded: () => {
      useStore.getState().setPlayback({ isPlaying: false });
      setMediaSessionPlaybackState('paused');
    },
  });

  // Fire generate for song 1 immediately, in parallel with prelude playback.
  synthesizer.generateNext().catch(() => undefined);

  // Pick a prelude based on initial intensity / phase.
  let preludePlayed = false;
  try {
    const manifest = await loadPreludesManifest();
    if (manifest.preludes.length > 0) {
      const intensity = motion.read().intensityNormalized;
      const phase = readClock().phase;
      const prelude = pickPrelude(manifest, intensity, phase);
      if (prelude) {
        const url = preludeUrl(prelude.id);
        const songRecord: PlayedSong = {
          songId: prelude.id,
          songUrl: url,
          metadata: prelude.metadata,
          composition: prelude.composition,
          durationSec: prelude.durationSec,
          source: 'prelude',
        };
        useStore.getState().appendSong(songRecord);
        await engine.start(url, prelude.id);
        preludePlayed = true;
      }
    }
  } catch (err) {
    console.warn('prelude playback failed', err);
  }

  // If no prelude available, the audio engine remains idle until song 1 enqueues.
  // The synthesizer has already kicked off /generate; audio will start ~when it returns.
  if (!preludePlayed) {
    // Enqueue is idempotent vs start: SongSynthesizer.generateNext()'s eventual
    // engine.enqueue() will fall through to engine.start() since engine.current is null.
    // No further action needed here.
  }

  let scheduledFinalize = false;
  const scheduleFinalize = (): void => {
    scheduledFinalize = true;
  };

  const detach = (): void => {
    aggregator.stop();
    motion.stop();
    geolocation.stop();
    engine.stop();
    features.finish();
  };
  void scheduledFinalize;
  void measuredSampleStartedAt;

  active = { engine, synthesizer, motion, geolocation, aggregator, features, detach, scheduleFinalize };
  return active;
}

export function clearActiveRuntime(): void {
  if (active) active.detach();
  active = null;
}
