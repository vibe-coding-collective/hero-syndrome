import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickerPalette } from '../components/StickerPalette';
import { StickerOverlay } from '../components/StickerOverlay';
import { Visualization } from '../components/Visualization';
import { startScene, clearActiveRuntime } from '../session/start';
import { endScene } from '../session/end';
import { IdleWatcher } from '../session/idle';
import { useStore } from '../state/store';

type Stage = 'permission' | 'starting' | 'live' | 'ending';

export default function Scene() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('permission');
  const [error, setError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const idleRef = useRef<IdleWatcher | null>(null);
  const sessionId = useStore((s) => s.sessionId);
  const songs = useStore((s) => s.songs);
  const isPlaying = useStore((s) => s.isPlaying);
  const stateVector = useStore((s) => s.stateVector);
  const generationLatencyEMA = useStore((s) => s.generationLatencyEMA);

  useEffect(() => {
    return () => {
      idleRef.current?.stop();
      clearActiveRuntime();
    };
  }, []);

  const beginNow = async (): Promise<void> => {
    setStage('starting');
    setError(null);
    try {
      const runtime = await startScene();
      setAnalyser(runtime.engine.analyser);
      setStage('live');
      const watcher = new IdleWatcher(() => {
        if (stage === 'live') void onEnd();
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
    const res = await endScene();
    if (res) {
      navigate(`/episode/${res.episodeId}`);
    } else {
      setError('Could not finalize the scene. Please try again.');
      setStage('live');
    }
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
    <div className="relative h-screen w-screen overflow-hidden bg-paper text-ink">
      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="font-mono text-[10px] small-caps text-ink/65">
          {sessionId ? `Scene · ${sessionId.slice(-6)}` : 'Scene'}
        </div>
        <button
          type="button"
          onClick={onEnd}
          disabled={stage === 'ending'}
          className="rounded-full border border-ink/30 bg-paper/70 px-4 py-1.5 font-mono text-[11px] small-caps text-ink/85 backdrop-blur transition hover:bg-paper disabled:opacity-50"
        >
          {stage === 'ending' ? 'closing…' : 'End scene'}
        </button>
      </header>

      <main className="absolute inset-0">
        <Visualization analyser={analyser} />
        <StickerOverlay />
      </main>

      <SceneStatus
        isPlaying={isPlaying}
        songsCount={songs.length}
        latencyMs={generationLatencyEMA}
        place={stateVector?.location?.placeType ?? null}
        condition={stateVector?.weather?.condition ?? null}
        phase={stateVector?.time?.phase ?? null}
        intensity={stateVector?.movement?.intensityNormalized ?? null}
      />

      <StickerPalette />
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

function SceneStatus(props: {
  isPlaying: boolean;
  songsCount: number;
  latencyMs: number;
  place: string | null;
  condition: string | null;
  phase: string | null;
  intensity: number | null;
}) {
  return (
    <div className="absolute inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-20 px-5 text-center">
      <p className="font-mono text-[10px] small-caps text-ink/65">
        {props.isPlaying ? `song ${props.songsCount} · gen ema ${Math.round(props.latencyMs / 1000)}s` : 'preparing the score…'}
      </p>
      <p className="mt-1 font-serif text-[15px] italic text-ink/80">
        {[props.phase, props.place, props.condition, props.intensity != null ? `intensity ${props.intensity.toFixed(2)}` : null]
          .filter(Boolean)
          .join(' · ') || ' '}
      </p>
    </div>
  );
}
