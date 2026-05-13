import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DiskUiPrototype from '../components/DiskUiPrototype';
import { startScene, clearActiveRuntime } from '../session/start';
import { AudioEngine } from '../audio/engine';
import { endScene } from '../session/end';
import { IdleWatcher } from '../session/idle';

type Stage = 'permission' | 'starting' | 'live' | 'ending';

export default function Scene() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('permission');
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const stageRef = useRef<Stage>('permission');
  const idleRef = useRef<IdleWatcher | null>(null);

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

  const beginNow = async (): Promise<void> => {
    // CRITICAL: build the AudioContext + play a silent buffer SYNCHRONOUSLY
    // inside the click handler. iOS Safari only unlocks Web Audio if this
    // happens in the same task as the user gesture; awaiting permissions
    // first kills the unlock window.
    const audioCtx = AudioEngine.unlockedContext();
    setStage('starting');
    setError(null);
    try {
      const runtime = await startScene(audioCtx);
      setAnalyser(runtime.engine.analyser);
      setStage('live');
      const watcher = new IdleWatcher(() => {
        if (stageRef.current === 'live') void onEnd();
      });
      watcher.start();
      idleRef.current = watcher;
    } catch (err) {
      console.error(err);
      setError(String(err));
      setStage('permission');
    }
  };

  const onEnd = async (): Promise<void> => {
    setStage('ending');
    idleRef.current?.stop();
    idleRef.current = null;
    await endScene();
    navigate('/');
  };

  if (stage === 'permission') {
    return <PermissionGate onBegin={beginNow} error={error} />;
  }

  if (stage === 'starting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <p className="font-mono text-[11px] small-caps text-ink/65">opening the audio context…</p>
      </div>
    );
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

function PermissionGate({ onBegin, error }: { onBegin: () => void; error: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <div className="max-w-md">
        <p className="font-mono text-[11px] small-caps text-ink/55 mb-4">Before we begin</p>
        <h2 className="font-serif text-[36px] leading-[1.05] tracking-tight md:text-[48px]">
          A scene reads what your phone already knows.
        </h2>
        <p className="mt-6 font-serif text-[17px] leading-[1.6] text-ink/85 md:text-[19px]">
          Time of day, motion, weather, where you are. Nothing leaves the
          device unless it shapes the next song. Granting motion + location
          makes the score richer; refusing them is fine — clock and weather
          are still expressive.
        </p>
        <button
          type="button"
          onClick={onBegin}
          className="group mt-10 inline-flex items-baseline gap-3 border border-rust px-7 py-4 font-serif text-[20px] text-rust transition-colors duration-300 hover:bg-rust hover:text-paper"
        >
          Begin scene
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
        {error ? (
          <p className="mt-6 font-mono text-[11px] small-caps text-rust">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
