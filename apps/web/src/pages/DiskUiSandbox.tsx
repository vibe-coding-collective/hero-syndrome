import { useEffect, useMemo, useState } from 'react';
import DataDrawer from '../components/DataDrawer';
import DiskUiPrototype from '../components/DiskUiPrototype';
import { useStore } from '../state/store';
import {
  createDemoDialSong,
  type DemoDialPreset,
} from '../prototype/demoDialData';

const PRESET_HOURS: Record<DemoDialPreset, number> = {
  day: 15.75,
  rain: 9.25,
  night: 22.4,
};

export default function DiskUiSandbox() {
  const [preset, setPreset] = useState<DemoDialPreset>('day');
  const [hour, setHour] = useState(PRESET_HOURS.day);
  const [progress, setProgress] = useState(0.28);
  const [isPlaying, setIsPlaying] = useState(true);
  const [revision, setRevision] = useState(1);

  const demoSong = useMemo(
    () => createDemoDialSong({
      hour,
      preset,
      progress,
      revision,
      nowMs: performance.now(),
    }),
    [hour, preset, progress, revision],
  );

  useEffect(() => {
    const store = useStore.getState();
    store.resetSession();
    store.setSession({
      sessionId: 'disk-ui-sandbox',
      startedAt: Date.now(),
      songs: [demoSong],
    });
    store.setStateVector(demoSong.stateVector!);
    store.setPlayback({
      currentSongId: demoSong.songId,
      isPlaying,
    });

    return () => {
      useStore.getState().resetSession();
    };
  }, [demoSong, isPlaying]);

  const applyPreset = (nextPreset: DemoDialPreset) => {
    setPreset(nextPreset);
    setHour(PRESET_HOURS[nextPreset]);
    setRevision((current) => current + 1);
  };

  return (
    <div className="phone-dial-stage phone-dial-sandbox">
      <DiskUiPrototype analyser={null} />
      <DataDrawer song={demoSong} />

      <details className="phone-dial-sandbox__panel">
        <summary>UI sandbox</summary>
        <div className="phone-dial-sandbox__body">
          <div className="phone-dial-sandbox__presets" aria-label="Demo preset">
            {(['day', 'rain', 'night'] as const).map((item) => (
              <button
                aria-pressed={preset === item}
                className={preset === item ? 'is-active' : undefined}
                key={item}
                onClick={() => applyPreset(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <label className="phone-dial-sandbox__range">
            <span>Time</span>
            <input
              max="23.75"
              min="0"
              onChange={(event) => setHour(Number(event.target.value))}
              step="0.25"
              type="range"
              value={hour}
            />
            <strong>{formatHour(hour)}</strong>
          </label>

          <label className="phone-dial-sandbox__range">
            <span>Song</span>
            <input
              max="1"
              min="0"
              onChange={(event) => setProgress(Number(event.target.value))}
              step="0.01"
              type="range"
              value={progress}
            />
            <strong>{Math.round(progress * 100)}%</strong>
          </label>

          <div className="phone-dial-sandbox__actions">
            <button onClick={() => setIsPlaying((current) => !current)} type="button">
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={() => setRevision((current) => current + 1)} type="button">
              Spin overlay
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const wholeHour = Math.floor(normalized);
  const minutes = Math.round((normalized - wholeHour) * 60);
  return `${wholeHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
