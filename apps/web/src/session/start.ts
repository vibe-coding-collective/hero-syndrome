import { ulid } from 'ulid';
import type { StackedMeta, RenderPlan } from '@hero-syndrome/shared';
import { api } from '../api/client';
import { AudioEngine } from '../audio/engine';
import { AudioFeatureExtractor } from '../audio/audioFeatures';
import { setMediaSessionMetadata, setMediaSessionPlaybackState } from '../audio/mediaSession';
import { GeolocationSensor } from '../sensors/geolocation';
import { MotionSensor } from '../sensors/motion';
import { StateAggregator } from '../state/aggregator';
import { SongSynthesizer } from '../state/songSynthesizer';
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
      useStore.getState().setSongStarted(songId, startedAtMs, durationSec);
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

  // Wait for the aggregator's first tick that includes a geolocation fix
  // before generating any song. No timeout: if location can't be obtained
  // (permission denied, GPS unavailable), no song is generated and the user
  // stays on the loading screen. We don't want to ship a song that wasn't
  // composed against the user's actual place.
  aggregator.firstLocationTick.then(() => synthesizer.generateNext().catch(() => undefined));

  // The cosmic block is fetched in parallel; it's session-frozen so the
  // request will pick it up if it lands first, and the synthesizer's
  // watchdog will retry if it doesn't.
  void synthesizer; // referenced above

  // No prelude. The audio engine stays idle until song 1's audio lands; the
  // user sees the loading screen the whole time. SongSynthesizer.generateNext
  // eventually calls engine.enqueue, which falls through to engine.start
  // since engine.current is null.

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

export async function startTestScene(audioCtx?: AudioContext): Promise<SceneRuntime> {
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

  api.cosmicGlobal().then((cosmic) => useStore.getState().setSession({ cosmic })).catch(() => undefined);

  // Destroyed immediately — test mode drives audio manually, no watchdog needed.
  const synthesizer = new SongSynthesizer(engine);
  synthesizer.destroy();

  engine.setEvents({
    onSongStart: (songId, startedAtMs, durationSec) => {
      useStore.getState().setPlayback({ isPlaying: true, currentSongId: songId });
      useStore.getState().setSongStarted(songId, startedAtMs, durationSec);
      setMediaSessionMetadata({ title: 'Hero Syndrome — test scene' });
      setMediaSessionPlaybackState('playing');
      features.finish();
      features.begin(durationSec);
    },
    onAllEnded: () => {
      useStore.getState().setPlayback({ isPlaying: false });
      setMediaSessionPlaybackState('paused');
    },
  });

  const TEST_SONG_URL = '/test-song.mp3';

  aggregator.firstLocationTick.then(async () => {
    // Give weather/geocode enrichment a moment to land before snapshotting.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    const sv = useStore.getState().stateVector;
    const weatherCondition = sv?.weather?.condition ?? 'clear';
    const timePhase = sv?.time.phase ?? 'afternoon';
    const dayOfWeek = sv?.time.dayOfWeek ?? 'Monday';
    const bodyActivity = sv?.location?.bodyActivity;

    const stacked: StackedMeta = {
      energy: { motion: 0.3, density: 0.4, tension: 0.2, brightness: 0.5 },
      mood: { calm: 0.7, reflective: 0.5, melancholic: 0.3 },
      inspiration: { world: 'kyoto dusk rain', textureKeys: ['rain', 'urban', 'dusk'] },
      tideEffective: 0.5,
      weatherCondition,
      timePhase,
      moonPhase: 'full',
    };
    const renderPlan: RenderPlan = {
      meta: stacked,
      bpm: 95,
      totalDurationMs: 240_000,
      seed: ulid(),
      dayOfWeek,
      ...(bodyActivity ? { bodyActivity } : {}),
      locationType: sv?.location ? 'home_interior' : undefined,
    };
    const songId = `test-${ulid()}`;
    const played: PlayedSong = {
      songId,
      songUrl: TEST_SONG_URL,
      metadata: {
        bpmRange: [90, 100],
        key: 'D minor',
        intensity: 0.4,
        instrumentation: ['piano', 'strings', 'rain ambience'],
        genreTags: ['ambient', 'neo-classical'],
        transitionIntent: 'continue',
      },
      composition: {
        overallPrompt: 'Kyoto Dusk Rain — test track',
        sections: [{ label: 'main', durationSec: 240, prompt: 'ambient kyoto dusk rain' }],
      },
      durationSec: 240,
      source: 'generated',
      stateVector: sv ?? undefined,
      stacked,
      renderPlan,
      locationType: sv?.location ? 'home_interior' : undefined,
    };

    useStore.getState().appendSong(played);
    try {
      await engine.enqueue(TEST_SONG_URL, songId);
    } catch (err) {
      console.error('[test] enqueue failed', err);
    }
  }).catch(() => undefined);

  const scheduleFinalize = (): void => {};
  const detach = (): void => {
    aggregator.stop();
    motion.stop();
    geolocation.stop();
    engine.stop();
    features.finish();
  };

  active = { engine, synthesizer, motion, geolocation, aggregator, features, detach, scheduleFinalize };
  return active;
}

export async function startChurchScene(audioCtx?: AudioContext): Promise<SceneRuntime> {
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

  api.cosmicGlobal().then((cosmic) => useStore.getState().setSession({ cosmic })).catch(() => undefined);

  const synthesizer = new SongSynthesizer(engine);
  synthesizer.destroy();

  engine.setEvents({
    onSongStart: (songId, startedAtMs, durationSec) => {
      useStore.getState().setPlayback({ isPlaying: true, currentSongId: songId });
      useStore.getState().setSongStarted(songId, startedAtMs, durationSec);
      setMediaSessionMetadata({ title: 'Hero Syndrome — church scene' });
      setMediaSessionPlaybackState('playing');
      features.finish();
      features.begin(durationSec);
    },
    onAllEnded: () => {
      useStore.getState().setPlayback({ isPlaying: false });
      setMediaSessionPlaybackState('paused');
    },
  });

  const TEST_SONG_URL = '/test-song.mp3';

  aggregator.firstLocationTick.then(async () => {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
    const sv = useStore.getState().stateVector;
    const weatherCondition = sv?.weather?.condition ?? 'clear';
    const timePhase = sv?.time.phase ?? 'afternoon';
    const dayOfWeek = sv?.time.dayOfWeek ?? 'Monday';

    const stacked: StackedMeta = {
      energy: { motion: 0.2, density: 0.3, tension: 0.1, brightness: 0.4 },
      mood: { calm: 0.9, reflective: 0.7, melancholic: 0.2 },
      inspiration: { world: 'sacred space stillness', textureKeys: ['reverent', 'stone', 'echo'] },
      tideEffective: 0.5,
      weatherCondition,
      timePhase,
      moonPhase: 'full',
    };
    const renderPlan: RenderPlan = {
      meta: stacked,
      bpm: 72,
      totalDurationMs: 240_000,
      seed: ulid(),
      dayOfWeek,
      locationType: 'place_of_worship',
    };
    const songId = `church-${ulid()}`;
    const played: PlayedSong = {
      songId,
      songUrl: TEST_SONG_URL,
      metadata: {
        bpmRange: [68, 76],
        key: 'A minor',
        intensity: 0.3,
        instrumentation: ['organ', 'choir', 'reverb'],
        genreTags: ['ambient', 'sacred'],
        transitionIntent: 'continue',
      },
      composition: {
        overallPrompt: 'Church — sacred space, stillness',
        sections: [{ label: 'main', durationSec: 240, prompt: 'sacred ambient stillness' }],
      },
      durationSec: 240,
      source: 'generated',
      stateVector: sv ?? undefined,
      stacked,
      renderPlan,
      locationType: 'place_of_worship',
    };

    useStore.getState().appendSong(played);
    try {
      await engine.enqueue(TEST_SONG_URL, songId);
    } catch (err) {
      console.error('[church] enqueue failed', err);
    }
  }).catch(() => undefined);

  const scheduleFinalize = (): void => {};
  const detach = (): void => {
    aggregator.stop();
    motion.stop();
    geolocation.stop();
    engine.stop();
    features.finish();
  };

  active = { engine, synthesizer, motion, geolocation, aggregator, features, detach, scheduleFinalize };
  return active;
}

export function clearActiveRuntime(): void {
  if (active) active.detach();
  active = null;
}
