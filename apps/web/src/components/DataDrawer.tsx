import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { api } from '../api/client';
import { useStore, type PlayedSong } from '../state/store';

/** Per-songId locks for the /describe call. Module-level so re-renders and
 *  short-lived remounts (HMR, parent-driven reconciliation) don't fire
 *  duplicate requests. Once a fetch has completed (success or failure) we
 *  leave the songId in the set so we never retry within a session. */
const describeFetchedSongs = new Set<string>();

interface DataDrawerProps {
  song: PlayedSong;
}

type DataDrawerStyle = CSSProperties & { '--drawer-drag-y': string };

interface DrawerRow {
  label: string;
  value: string;
}

interface DrawerData {
  title: string;
  description: string;
  chips: string[];
  stateRows: DrawerRow[];
  musicRows: DrawerRow[];
}

export default function DataDrawer({ song }: DataDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; open: boolean } | null>(null);
  const data = useMemo<DrawerData>(() => buildDrawerData(song), [song]);
  const drawerStyle: DataDrawerStyle = { '--drawer-drag-y': `${dragY}px` };

  // Fetch the Claude-generated title + description as soon as the drawer
  // mounts for a generated song that doesn't have them yet. Skipped for
  // preludes (no stateVector/composition to describe) and for songs we've
  // already attempted once this session.
  useEffect(() => {
    if (song.source !== 'generated') return;
    if (song.title && song.description) return;
    if (describeFetchedSongs.has(song.songId)) return;
    const sessionId = useStore.getState().sessionId;
    if (!sessionId) return;
    describeFetchedSongs.add(song.songId);
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.describe({ sessionId, songId: song.songId });
        if (cancelled) return;
        useStore.getState().setSongDescription(res.songId, res.title, res.description);
      } catch (err) {
        if (!cancelled) console.warn('[drawer] describe failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [song.songId, song.source, song.title, song.description]);

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
        <div className="phone-data-drawer__copy">
          <h2 className="phone-data-drawer__title">{data.title}</h2>
          <p className="phone-data-drawer__body">{data.description}</p>
        </div>
      </button>

      <div className="phone-data-drawer__content">
        {data.chips.length > 0 ? (
          <div className="phone-data-drawer__chips">
            {data.chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        ) : null}

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

function buildDrawerData(song: PlayedSong): DrawerData {
  const state = song.stateVector;
  const weather = state?.weather;
  const location = state?.location;
  const cosmic = state?.cosmic;
  const stacked = song.stacked;
  const render = song.renderPlan;

  // Title + description come from the /describe Claude call when available.
  // Until that lands (or for preludes that never trigger it), fall back to a
  // data-derived placeholder so the drawer never reads as empty.
  const placeholderTitle = song.phraseOfTheMoment?.phrase
    ? song.phraseOfTheMoment.phrase.toUpperCase()
    : [
        displayToken(state?.time.phase ?? 'unknown phase'),
        displayToken(song.locationType ?? 'unknown place'),
      ].join(' / ');

  const bpm = render?.bpm ?? song.metadata.bpmRange[0];
  const moods = stacked ? topEntries(stacked.mood, 3) : [];
  const instruments = song.metadata.instrumentation.slice(0, 4);
  const descriptionParts: string[] = [
    `${bpm} BPM in ${song.metadata.key}.`,
    instruments.length > 0 ? `${instruments.join(', ')}.` : null,
    moods.length > 0 ? `${moods.map((m) => m.toLowerCase()).join(', ')}.` : null,
  ].filter((part): part is string => part !== null);
  const placeholderDescription = descriptionParts.join(' ');

  const title = song.title ?? placeholderTitle;
  const description = song.description ?? placeholderDescription;

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

  return {
    title,
    description,
    chips,
    musicRows,
    stateRows,
  };
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
