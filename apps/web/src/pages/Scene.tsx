import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import DataDrawer from '../components/DataDrawer';
import DiskUiPrototype from '../components/DiskUiPrototype';
import { useStore } from '../state/store';
import { startScene, startTestScene, clearActiveRuntime, getActiveRuntime } from '../session/start';
import { consumeUnlockedContext, peekUnlockedContext } from '../audio/engine';
import { endScene } from '../session/end';
import { IdleWatcher } from '../session/idle';

type Stage = 'starting' | 'live' | 'ending';

export default function Scene() {
  const navigate = useNavigate();
  const location = useLocation();
  const testMode = (location.state as { testMode?: boolean } | null)?.testMode === true;
  // Capture the stash presence once at first render via useState's lazy
  // initializer. Don't re-peek on subsequent renders: the start effect
  // consumes the stash, so a re-peek after state changes would see null and
  // trigger the deep-link redirect even though we did come from Landing.
  const [hasStashedContext] = useState(() => peekUnlockedContext() != null);
  const [stage, setStage] = useState<Stage>('starting');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const songs = useStore((s) => s.songs);
  const currentSongId = useStore((s) => s.currentSongId);
  const currentSong = currentSongId
    ? songs.find((song) => song.songId === currentSongId) ?? null
    : null;
  const stageRef = useRef<Stage>('starting');
  const idleRef = useRef<IdleWatcher | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    return () => {
      idleRef.current?.stop();
      idleRef.current = null;
      clearActiveRuntime();
    };
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    const ctx = consumeUnlockedContext();
    if (!ctx) return;
    startedRef.current = true;
    void (async () => {
      try {
        const runtime = await (testMode ? startTestScene(ctx) : startScene(ctx));
        setAnalyser(runtime.engine.analyser);
        setStage('live');
        const watcher = new IdleWatcher(() => {
          if (stageRef.current === 'live') void onEnd();
        });
        watcher.start();
        idleRef.current = watcher;
      } catch (err) {
        console.error('Scene start failed', err);
        navigate('/');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOrbClick = (): void => {
    const runtime = getActiveRuntime();
    if (!runtime || stage !== 'live') return;
    if (isPaused) {
      void runtime.engine.ctx.resume();
      setIsPaused(false);
    } else {
      void runtime.engine.ctx.suspend();
      setIsPaused(true);
    }
  };

  const onEnd = async (): Promise<void> => {
    setStage('ending');
    idleRef.current?.stop();
    idleRef.current = null;
    await endScene();
    navigate('/');
  };

  // Direct navigation to /scene (refresh, deep link) has no unlocked context
  // and no user gesture in flight. iOS would silently refuse audio. Bounce to
  // Landing so the user starts from the proper CTA.
  if (!hasStashedContext) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="phone-dial-stage">
      <DiskUiPrototype analyser={analyser} isPaused={isPaused} onOrbClick={onOrbClick} onOverlayChange={setOverlayActive} />
      <div className={`phone-data-drawer-wrapper${overlayActive ? ' phone-data-drawer-wrapper--hidden' : ''}`}>
        {currentSong ? <DataDrawer song={currentSong} /> : null}
      </div>
      <button
        type="button"
        onClick={onEnd}
        disabled={stage === 'ending'}
        className="phone-dial-end-pill"
        aria-label="End scene"
      >
        {stage === 'ending' ? 'closing…' : 'End scene'}
      </button>
    </div>
  );
}
