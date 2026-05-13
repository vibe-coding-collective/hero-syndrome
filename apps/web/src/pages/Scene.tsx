import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import DiskUiPrototype from '../components/DiskUiPrototype';
import { startScene, clearActiveRuntime } from '../session/start';
import { consumeUnlockedContext, peekUnlockedContext } from '../audio/engine';
import { endScene } from '../session/end';
import { IdleWatcher } from '../session/idle';

type Stage = 'starting' | 'live' | 'ending';

export default function Scene() {
  const navigate = useNavigate();
  // Capture the stash presence once at first render via useState's lazy
  // initializer. Don't re-peek on subsequent renders: the start effect
  // consumes the stash, so a re-peek after state changes would see null and
  // trigger the deep-link redirect even though we did come from Landing.
  const [hasStashedContext] = useState(() => peekUnlockedContext() != null);
  const [stage, setStage] = useState<Stage>('starting');
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
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
        const runtime = await startScene(ctx);
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
      <DiskUiPrototype analyser={analyser} />
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
