import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { PlayedSong } from '../state/store';

interface DataDrawerProps {
  song: PlayedSong;
}

type DataDrawerStyle = CSSProperties & { '--drawer-drag-y': string };

interface DrawerRow {
  label: string;
  value: string;
}

export default function DataDrawer({ song }: DataDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; open: boolean } | null>(null);
  const data = useMemo(() => buildDrawerData(song), [song]);
  const drawerStyle: DataDrawerStyle = { '--drawer-drag-y': `${dragY}px` };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { y: event.clientY, open: isOpen };
    setIsDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const delta = event.clientY - start.y;
    if (start.open) {
      setDragY(Math.min(360, Math.max(0, delta)));
      return;
    }
    setDragY(Math.max(-140, Math.min(0, delta)));
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStartRef.current = null;
    setIsDragging(false);
    if (!start) return;

    const delta = event.clientY - start.y;
    if (Math.abs(delta) < 8) {
      setIsOpen((current) => !current);
    } else if (start.open) {
      setIsOpen(delta < 72);
    } else {
      setIsOpen(delta < -36);
    }
    setDragY(0);
  };

  const onPointerCancel = () => {
    dragStartRef.current = null;
    setIsDragging(false);
    setDragY(0);
  };

  return (
    <aside
      aria-label="Data and composition drawer"
      className={[
        'phone-data-drawer',
        isOpen ? 'phone-data-drawer--open' : 'phone-data-drawer--closed',
        isDragging ? 'phone-data-drawer--dragging' : '',
      ].join(' ')}
      style={drawerStyle}
    >
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close data drawer' : 'Open data drawer'}
        className="phone-data-drawer__handle"
        onPointerCancel={onPointerCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        type="button"
      >
        <span className="phone-data-drawer__grab" />
        <span className="phone-data-drawer__peek">
          <span>
            <span className="phone-data-drawer__eyebrow">Data package</span>
            <strong>{data.title}</strong>
          </span>
          <span className="phone-data-drawer__hint">{isOpen ? 'Slide down' : 'Slide up'}</span>
        </span>
      </button>

      <div className="phone-data-drawer__content">
        <section className="phone-data-drawer__hero" aria-label="Current composition package">
          <p>Current state vector</p>
          <h2>{data.title}</h2>
          <div className="phone-data-drawer__chips">
            {data.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </section>

        <section className="phone-data-drawer__section" aria-label="Data used">
          <h3>Data used</h3>
          <div className="phone-data-drawer__rows">
            {data.stateRows.map((row) => (
              <DataRow key={row.label} row={row} />
            ))}
          </div>
        </section>

        <section className="phone-data-drawer__section" aria-label="Music direction">
          <h3>Music direction</h3>
          <div className="phone-data-drawer__rows">
            {data.musicRows.map((row) => (
              <DataRow key={row.label} row={row} />
            ))}
          </div>
        </section>

        <section className="phone-data-drawer__section" aria-label="Composition plan">
          <h3>Composition plan</h3>
          <p className="phone-data-drawer__prompt">{song.composition.overallPrompt}</p>
          <div className="phone-data-drawer__sections">
            {song.composition.sections.map((section) => (
              <article key={`${section.label}-${section.durationSec}`} className="phone-data-drawer__composition-card">
                <span>{section.durationSec}s</span>
                <strong>{section.label}</strong>
                <p>{section.prompt}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function DataRow({ row }: { row: DrawerRow }) {
  return (
    <div className="phone-data-drawer__row">
      <span>{row.label}</span>
      <strong>{row.value}</strong>
    </div>
  );
}

function buildDrawerData(song: PlayedSong) {
  const state = song.stateVector;
  const weather = state?.weather;
  const location = state?.location;
  const cosmic = state?.cosmic;
  const stacked = song.stacked;
  const render = song.renderPlan;
  const title = [
    displayToken(state?.time.phase ?? 'unknown phase'),
    displayToken(song.locationType ?? 'unknown place'),
    displayToken(song.bodyActivity ?? location?.bodyActivity ?? 'unknown motion'),
  ].join(' / ');

  const chips = [
    render ? `${render.bpm} BPM` : null,
    song.metadata.key,
    song.phraseOfTheMoment?.phrase,
  ].filter(Boolean) as string[];

  const stateRows: DrawerRow[] = [
    { label: 'Time', value: state ? `${formatHour(state.time.hour)} / ${displayToken(state.time.phase)}` : 'Unknown' },
    { label: 'Weather', value: weather ? `${displayToken(weather.condition)} / ${Math.round(weather.tempC)}C / ${Math.round(weather.humidityPct)}%` : 'Unknown' },
    { label: 'Location', value: location?.place?.name ?? location?.neighborhood ?? location?.city ?? 'Unknown' },
    { label: 'Motion', value: state ? `${displayToken(state.movement.pattern)} / ${(state.movement.intensityNormalized * 100).toFixed(0)}%` : 'Unknown' },
    { label: 'Speed', value: location ? `${Math.round(location.speedMps * 3.6)} km/h` : 'Unknown' },
    { label: 'Space weather', value: cosmic?.spaceWeather ? `K${cosmic.spaceWeather.kIndex} / ${Math.round(cosmic.spaceWeather.solarWindSpeedKmS)} km/s` : 'Unknown' },
  ];

  const musicRows: DrawerRow[] = [
    { label: 'BPM range', value: `${song.metadata.bpmRange[0]}-${song.metadata.bpmRange[1]}` },
    { label: 'Key', value: song.metadata.key },
    { label: 'Intensity', value: `${Math.round(song.metadata.intensity * 100)}%` },
    { label: 'Transition', value: displayToken(song.metadata.transitionIntent) },
    { label: 'Instruments', value: song.metadata.instrumentation.join(', ') },
    { label: 'Mood', value: stacked ? topEntries(stacked.mood).join(', ') : song.metadata.genreTags.join(', ') },
    { label: 'Seed', value: render?.seed ?? 'Unknown' },
  ];

  return { chips, musicRows, stateRows, title };
}

function topEntries(values: Record<string, number>, count = 3): string[] {
  return Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key]) => displayToken(key));
}

function displayToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toUpperCase();
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const wholeHour = Math.floor(normalized);
  const minutes = Math.round((normalized - wholeHour) * 60);
  return `${wholeHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
