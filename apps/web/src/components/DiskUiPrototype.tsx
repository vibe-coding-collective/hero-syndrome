import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MoonPhase, WeatherCondition } from '@hero-syndrome/shared';
import { AUDIO_RAMP_SEC } from '../audio/engine';
import { useStore } from '../state/store';
import {
  buildDialViewModelFromSong,
  type DialViewModel,
} from '../prototype/dialViewModel';
import { Orb } from './ui/orb';

const ASSETS = {
  background: '/prototype-dial/background.png',
  outerRing: '/prototype-dial/outer-ring.svg',
  innerRing: '/prototype-dial/inner-ring.svg',
  innerCore: '/prototype-dial/inner-core.svg',
  selectionControlRing: '/prototype-dial/selection-control-ring.svg',
  selectionDashRing: '/prototype-dial/selection-dash-ring.svg',
  selectionInnerRing: '/prototype-dial/selection-inner-ring.svg',
  selectionInnerCore: '/prototype-dial/selection-inner-core.svg',
  selectionLine: '/prototype-dial/selection-line.svg',
  selectionPointer: '/prototype-dial/selection-pointer.svg',
} as const;

/** Phase-specific moon icons. Each SVG carries its own crescent/gibbous mask
 *  and drop-shadow filter; the lunar texture is a shared external PNG so the
 *  browser only fetches it once across all phases. */
const MOON_ASSETS: Record<MoonPhase, string> = {
  new: '/prototype-dial/moon/new.svg',
  waxing_crescent: '/prototype-dial/moon/waxing-crescent.svg',
  first_quarter: '/prototype-dial/moon/first-quarter.svg',
  waxing_gibbous: '/prototype-dial/moon/waxing-gibbous.svg',
  full: '/prototype-dial/moon/full.svg',
  waning_gibbous: '/prototype-dial/moon/waning-gibbous.svg',
  third_quarter: '/prototype-dial/moon/third-quarter.svg',
  waning_crescent: '/prototype-dial/moon/waning-crescent.svg',
};

const FRAME = { width: 393, height: 852 };
const DIAL_CENTER = { x: 197, y: 426 };
const CENTER_ORB_SIZE = 111;
const ORB_BEZEL_INNER_RADIUS = CENTER_ORB_SIZE / 2 - 1.5;
const ORB_BEZEL_OUTER_RADIUS = 80.5;
const SUN_ORBIT_RADIUS = 137;
const OUTER_RADIUS = 181;
const MUSIC_PROGRESS_RADIUS = OUTER_RADIUS - 6;
const TOP_MATERIAL_LABEL_RADIUS = 66;
const BOTTOM_MATERIAL_LABEL_RADIUS = 66;
const LOCATION_LABEL_RADIUS = 119;
const BUTTON_INNER_RADIUS = 75;
const BUTTON_OUTER_RADIUS = 101;
const BUTTON_TEXT_RADIUS = 88;
const BUTTON_ARC_SPAN = 92;
const SELECTION_CONTROL_RING_SIZE = 213;
const SELECTION_POINTER = { width: 85.336, height: 111.5 };
/** Fixed light-blue palette for the reactive orb. Replaces the previous
 *  per-weather dynamic palette so the orb reads as the same kind of object
 *  across all dial states (day rain, night clear, etc.) — only the music
 *  reactivity and adaptive brightness move. */
const ORB_COLORS: [string, string] = ['#b7ccff', '#5f7ea8'];
/** Total window the song-boundary overlay is mounted for, in ms. The CSS
 *  animations in `phone-dial__location-overlay` and `phone-dial__location-list`
 *  must sum to this duration. The wheel transition fires at
 *  TRANSITION_LEAD_MS before the current song ends so it completes exactly at
 *  the song boundary (audio crossfade is 5s wide; visuals run the back half). */
const OVERLAY_DURATION_MS = 2500;
const TRANSITION_LEAD_MS = 2500;

type MusicProgressMode = 'idle' | 'loading' | 'playback';

type DialTurnStyle = CSSProperties & { '--dial-turn-from': string };

interface DialTurnAnimation {
  key: string;
  style: DialTurnStyle;
}

interface DiskUiPrototypeProps {
  /** AnalyserNode from the parent AudioEngine. When present and audio is
   *  playing, drives the Orb's reactive level. */
  analyser: AnalyserNode | null;
  isPaused?: boolean;
  onOrbClick?: () => void;
  /** Called whenever the SelectionOverlay (spinning wheel at song boundaries)
   *  appears or disappears, so the parent can hide/show the DataDrawer. */
  onOverlayChange?: (active: boolean) => void;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** True for any daytime weather that should show cloud highlights in the
 *  background — anything other than clear / mainly-clear skies. Drives the
 *  conditional `cloudHighlight` overlay so the dial reads like a real sky
 *  during overcast, drizzle, rain, snow, fog and storms. */
function isCloudyCondition(condition: WeatherCondition): boolean {
  return condition !== 'clear' && condition !== 'mainly_clear';
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function shortestIndexDelta(fromIndex: number, toIndex: number, count: number): number {
  const raw = toIndex - fromIndex;
  const half = count / 2;
  const normalized = modulo(raw + half, count) - half;
  if (count % 2 === 0 && Math.abs(normalized) === half) {
    return (Math.random() < 0.5 ? -1 : 1) * half;
  }
  return normalized;
}

function turnFromPreviousSelection(
  previousSelectedId: string,
  selectedId: string,
  previousOptionIds: string[],
  currentOptionIds: string[],
): number {
  const candidateSets = [
    uniqueIds(currentOptionIds),
    uniqueIds(previousOptionIds),
    uniqueIds([...previousOptionIds, ...currentOptionIds]),
  ];

  for (const ids of candidateSets) {
    if (ids.length < 2) continue;
    const previousIndex = ids.indexOf(previousSelectedId);
    const selectedIndex = ids.indexOf(selectedId);
    if (previousIndex === -1 || selectedIndex === -1) continue;
    const delta = shortestIndexDelta(previousIndex, selectedIndex, ids.length);
    if (delta === 0) return 0;
    const step = 360 / ids.length;
    const magnitude = Math.min(150, Math.max(24, Math.abs(delta) * step));
    return delta > 0 ? magnitude : -magnitude;
  }

  return (Math.random() < 0.5 ? -1 : 1) * 42;
}

function useShortestDialTurn(
  selectedId: string | null,
  optionIds: string[],
  scope: string,
): DialTurnAnimation {
  const previousRef = useRef<{ selectedId: string | null; optionIds: string[] }>({
    selectedId: null,
    optionIds: [],
  });
  const sequenceRef = useRef(0);
  const [turn, setTurn] = useState<{ key: string; fromDegrees: number }>(() => ({
    key: `${scope}-initial`,
    fromDegrees: 0,
  }));
  const optionSignature = optionIds.join('|');

  useLayoutEffect(() => {
    const previous = previousRef.current;
    if (selectedId && previous.selectedId && previous.selectedId !== selectedId) {
      const fromDegrees = turnFromPreviousSelection(
        previous.selectedId,
        selectedId,
        previous.optionIds,
        optionIds,
      );
      sequenceRef.current += 1;
      setTurn({
        key: `${scope}-${sequenceRef.current}`,
        fromDegrees,
      });
    }
    previousRef.current = { selectedId, optionIds };
  }, [optionSignature, optionIds, scope, selectedId]);

  return {
    key: turn.key,
    style: { '--dial-turn-from': `${turn.fromDegrees.toFixed(3)}deg` },
  };
}

function hourToAngle(hour: number): number {
  return normalizeDegrees((hour - 12) * 15);
}

function pointOnOrbit(angle: number, radius: number): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return {
    x: DIAL_CENTER.x + Math.sin(radians) * radius,
    y: DIAL_CENTER.y - Math.cos(radians) * radius,
  };
}

function formatHour(hour: number): string {
  return `${Math.round(hour).toString().padStart(2, '0')}:00`;
}

function arcPath(radius: number, midAngle: number, span = 20): string {
  const start = pointOnOrbit(midAngle - span / 2, radius);
  const end = pointOnOrbit(midAngle + span / 2, radius);
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function bottomArcPath(radius: number, midAngle: number, span = 20): string {
  const start = pointOnOrbit(midAngle + span / 2, radius);
  const end = pointOnOrbit(midAngle - span / 2, radius);
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 0 0 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function annularRingPath(innerRadius: number, outerRadius: number, startAngle = 0): string {
  const segmentCount = 96;
  const outerPoints = Array.from({ length: segmentCount + 1 }, (_, index) => {
    return pointOnOrbit(startAngle + 360 * (index / segmentCount), outerRadius);
  });
  const innerPoints = Array.from({ length: segmentCount + 1 }, (_, index) => {
    return pointOnOrbit(startAngle + 360 * (1 - index / segmentCount), innerRadius);
  });
  const [outerStart, ...outerRest] = outerPoints;
  const [innerStart, ...innerRest] = innerPoints;

  return [
    `M ${outerStart!.x.toFixed(3)} ${outerStart!.y.toFixed(3)}`,
    ...outerRest.map((point) => `L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`),
    'Z',
    `M ${innerStart!.x.toFixed(3)} ${innerStart!.y.toFixed(3)}`,
    ...innerRest.map((point) => `L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`),
    'Z',
  ].join(' ');
}

function annularArcPath(innerRadius: number, outerRadius: number, midAngle: number, span: number): string {
  const outerStart = pointOnOrbit(midAngle - span / 2, outerRadius);
  const outerEnd = pointOnOrbit(midAngle + span / 2, outerRadius);
  const innerEnd = pointOnOrbit(midAngle + span / 2, innerRadius);
  const innerStart = pointOnOrbit(midAngle - span / 2, innerRadius);
  const largeArc = span > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ');
}

function ClockMarks() {
  return (
    <g className="phone-dial__clock-marks">
      {Array.from({ length: 24 }).map((_, hour) => {
        const angle = hourToAngle(hour);
        const outer = pointOnOrbit(angle, OUTER_RADIUS);
        const inner = pointOnOrbit(angle, OUTER_RADIUS - (hour % 6 === 0 ? 18 : hour % 3 === 0 ? 13 : 8));
        return (
          <line
            className={hour % 6 === 0 ? 'is-major' : undefined}
            key={hour}
            strokeLinecap="round"
            x1={inner.x}
            x2={outer.x}
            y1={inner.y}
            y2={outer.y}
          />
        );
      })}
    </g>
  );
}

/** True-circle progress ring. Track/backing are plain <circle>s so the curve
 *  renders at device resolution (no polygon facets). The fill uses
 *  pathLength=1 + stroke-dashoffset and a CSS transition longer than the
 *  driver tick — the browser interpolates the offset every frame, so the line
 *  sweeps continuously instead of stepping at the 250ms cadence. */
function MusicProgressRing(props: {
  mode: MusicProgressMode;
  progress: number;
  startAngle: number;
  songKey: string;
}) {
  const clampedProgress = clamp01(props.progress);
  return (
    <g
      aria-label={`Music progress: ${Math.round(clampedProgress * 100)} percent`}
      className={`phone-dial__music-progress phone-dial__music-progress--${props.mode}`}
      role="img"
    >
      <circle
        className="phone-dial__music-progress-backing"
        cx={DIAL_CENTER.x}
        cy={DIAL_CENTER.y}
        fill="none"
        r={MUSIC_PROGRESS_RADIUS}
      />
      <circle
        className="phone-dial__music-progress-track"
        cx={DIAL_CENTER.x}
        cy={DIAL_CENTER.y}
        fill="none"
        r={MUSIC_PROGRESS_RADIUS}
      />
      {props.mode !== 'idle' ? (
        <circle
          className="phone-dial__music-progress-fill"
          cx={DIAL_CENTER.x}
          cy={DIAL_CENTER.y}
          fill="none"
          key={`fill-${props.songKey}`}
          pathLength={1}
          r={MUSIC_PROGRESS_RADIUS}
          strokeDasharray="1 1"
          strokeDashoffset={1 - clampedProgress}
          transform={`rotate(${props.startAngle - 90} ${DIAL_CENTER.x} ${DIAL_CENTER.y})`}
        />
      ) : null}
    </g>
  );
}

/** Center orb rendered as an absolutely-positioned HTML div on top of the dial
 *  SVG. Lives outside the SVG (and not in a `<foreignObject>`) because iOS
 *  Safari can offset foreignObject contents from the SVG viewBox when the SVG
 *  is CSS-scaled — the orb visibly drifts off-center on a phone even though
 *  the SVG geometry says it's at DIAL_CENTER. CSS percentages relative to the
 *  393×852 viewBox keep it locked to the dial's visual center on every
 *  browser. */
function CenterOrb(props: {
  colors: [string, string];
  isMusicPlaying: boolean;
  musicLevel: number;
  seed: number;
  isPaused?: boolean;
  onClick?: () => void;
}) {
  const orbState = props.isMusicPlaying ? 'talking' : null;
  const orbKey = `${props.colors[0]}-${props.colors[1]}-${props.seed}`;
  const levelRef = useRef(props.musicLevel);
  levelRef.current = props.musicLevel;

  return (
    <div
      className="phone-dial__orb-layer"
      onClick={props.onClick}
      style={props.onClick ? { pointerEvents: 'auto', cursor: 'pointer' } : undefined}
      aria-label={props.isPaused ? 'Resume' : 'Pause'}
      role={props.onClick ? 'button' : undefined}
    >
      <div className="phone-dial__orb-shell" style={{ position: 'relative', pointerEvents: 'none' }}>
        <Orb
          agentState={orbState}
          className="phone-dial__orb-canvas"
          colors={props.colors}
          getOutputVolume={() => levelRef.current}
          key={orbKey}
          seed={props.seed}
          volumeMode="manual"
        />
        {props.isPaused && (
          <img
            src="/play.svg"
            alt=""
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '48px',
              height: '48px',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

function OrbBezel() {
  return (
    <g className="phone-dial__orb-bezel" pointerEvents="none">
      <path
        className="phone-dial__orb-bezel-fill"
        d={annularRingPath(ORB_BEZEL_INNER_RADIUS, ORB_BEZEL_OUTER_RADIUS)}
        fillRule="evenodd"
      />
    </g>
  );
}

function WeatherIcon(props: { condition: string; isNight: boolean }) {
  const folder = props.isNight ? 'night' : 'day';
  const href = `/weather/${folder}/${props.condition}.svg`;
  return (
    <image
      href={href}
      width="60"
      height="60"
      x={DIAL_CENTER.x - 30}
      y="42"
    />
  );
}

/** Moon indicator rendered from the phase-specific asset (each SVG carries its
 *  own mask + drop-shadow filter; phase determines which crescent/gibbous
 *  silhouette is illuminated). 78×78 viewBox matches the source SVGs exactly,
 *  so positioning by (props.x - 39, props.y - 39) puts the moon disc at
 *  (props.x, props.y). Falls back to 'full' for safety. */
function MoonIndicator(props: { x: number; y: number; phase: MoonPhase }) {
  const href = MOON_ASSETS[props.phase] ?? MOON_ASSETS.full;
  return (
    <g
      className="phone-dial__moon-indicator phone-dial__celestial-indicator"
      transform={`translate(${props.x - 39} ${props.y - 39})`}
    >
      <image href={href} width="78" height="78" />
    </g>
  );
}

function SunIndicator(props: { x: number; y: number }) {
  return (
    <image
      className="phone-dial__sun-indicator phone-dial__celestial-indicator"
      href="/sun.svg"
      width="52"
      height="52"
      x={props.x - 26}
      y={props.y - 26}
    />
  );
}

/** Read-only selection overlay that auto-plays a spin-in animation at each
 *  song boundary. No pointer handlers — the wheel rotates from a full
 *  revolution back to 0 via CSS keyframes, landing on the song's top-scored
 *  option (always at index 0 in the option list). */
function SelectionOverlay({ model }: { model: DialViewModel }) {
  // Build the wheel from location options, falling back to activity options,
  // then to a single coords/phase placeholder so the overlay always renders
  // something — never null. (When location data is missing for the whole
  // session, the overlay used to disappear entirely; the wheel needs at
  // least one item to spin around.)
  const fallbackLabel = model.coordsLabel || model.phaseLabel;
  const wheelOptions = model.locationOptions.length > 0
    ? model.locationOptions
    : model.activityOptions.length > 0
      ? model.activityOptions
      : [{ id: 'fallback', kind: 'location' as const, label: fallbackLabel, value: fallbackLabel, score: 0, source: 'fallback' }];
  const step = wheelOptions.length > 0 ? 360 / wheelOptions.length : 0;
  const selected = wheelOptions[0]!;
  const selectedArcId = `location-selected-arc`;

  return (
    <div className="phone-dial__location-overlay">
      <svg
        aria-label={`Selection dial: ${selected.label}`}
        className="phone-dial__location-artboard"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      >
        <defs>
          <path id={selectedArcId} d={arcPath(LOCATION_LABEL_RADIUS, 0, Math.min(48, step * 0.92))} />
        </defs>

        <image href={ASSETS.selectionLine} height="1" opacity="0.4" width="407" x="-10" y={DIAL_CENTER.y} />
        <image href={ASSETS.selectionDashRing} height="330" opacity="0.9" width="330" x="31.5" y="261" />

        <image
          href={ASSETS.selectionInnerRing}
          height="161"
          width="160"
          x={DIAL_CENTER.x - 80}
          y={DIAL_CENTER.y - 80.5}
        />
        <image
          href={ASSETS.selectionInnerCore}
          height="83"
          width="83"
          x={DIAL_CENTER.x - 41.5}
          y={DIAL_CENTER.y - 41.5}
        />

        <g className="phone-dial__location-list">
          {wheelOptions.map((option, index) => {
            const angle = index * step;
            const pathId = `location-option-${index}`;
            const separatorPathId = `${pathId}-separator`;
            return (
              <g className={index === 0 ? 'is-selected' : undefined} key={option.id}>
                <defs>
                  <path id={pathId} d={arcPath(LOCATION_LABEL_RADIUS, angle, Math.min(42, step * 0.86))} />
                  <path id={separatorPathId} d={arcPath(LOCATION_LABEL_RADIUS, angle + step / 2, 8)} />
                </defs>
                <text className="phone-dial__location-option-label">
                  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                    {option.label}
                  </textPath>
                </text>
                <text className="phone-dial__location-separator">
                  <textPath href={`#${separatorPathId}`} startOffset="50%" textAnchor="middle">
                    .
                  </textPath>
                </text>
              </g>
            );
          })}
        </g>

        <image
          href={ASSETS.selectionControlRing}
          height={SELECTION_CONTROL_RING_SIZE}
          width={SELECTION_CONTROL_RING_SIZE}
          x={DIAL_CENTER.x - SELECTION_CONTROL_RING_SIZE / 2}
          y={DIAL_CENTER.y - SELECTION_CONTROL_RING_SIZE / 2}
        />
        <g className="phone-dial__location-confirm" aria-hidden>
          <image
            href={ASSETS.selectionPointer}
            height={SELECTION_POINTER.height}
            width={SELECTION_POINTER.width}
            x={DIAL_CENTER.x - SELECTION_POINTER.width / 2}
            y={DIAL_CENTER.y - SELECTION_POINTER.height}
          />
          <text className="phone-dial__location-selected">
            <textPath href={`#${selectedArcId}`} startOffset="50%" textAnchor="middle">
              {selected.label}
            </textPath>
          </text>
        </g>
      </svg>
    </div>
  );
}

function WaitingDial() {
  return (
    <section className="phone-dial phone-dial--waiting" aria-label="Preparing the scene">
      <div className="phone-dial__waiting-shell">
        <div className="phone-dial__waiting-orb">
          <Orb agentState="thinking" className="phone-dial__orb-canvas" colors={['#cadcfc', '#7783c4']} />
        </div>
        <p className="phone-dial__waiting-label">preparing the scene…</p>
      </div>
    </section>
  );
}

export default function DiskUiPrototype({ analyser, isPaused, onOrbClick, onOverlayChange }: DiskUiPrototypeProps) {
  const songs = useStore((state) => state.songs);
  const currentSongId = useStore((state) => state.currentSongId);
  const isPlaying = useStore((state) => state.isPlaying);
  const [progressClock, setProgressClock] = useState(() => performance.now());
  const [musicOrbLevel, setMusicOrbLevel] = useState(0);
  const [overlayActive, setOverlayActive] = useState(false);
  // Track cumulative paused time so the progress ring freezes on pause.
  const pauseOffsetMsRef = useRef(0);
  const pausedSinceRef = useRef<number | null>(null);

  // Reset pause offset when the song changes.
  useEffect(() => {
    pauseOffsetMsRef.current = 0;
    pausedSinceRef.current = null;
  }, [currentSongId]);

  // Accumulate pause duration whenever isPaused flips.
  useEffect(() => {
    if (isPaused) {
      pausedSinceRef.current = performance.now();
    } else {
      if (pausedSinceRef.current != null) {
        pauseOffsetMsRef.current += performance.now() - pausedSinceRef.current;
        pausedSinceRef.current = null;
      }
    }
  }, [isPaused]);

  const currentSong = useMemo(
    () => (currentSongId ? songs.find((song) => song.songId === currentSongId) ?? null : null),
    [currentSongId, songs],
  );

  /** Song whose data the dial *visualizes*. Leads the audio engine by
   *  TRANSITION_LEAD_MS so the dial body crossfades in lockstep with the audio
   *  fade-in's second half. Until that lead-in, equals the currently playing
   *  song. After it, equals the next song already in the queue. */
  const displayedSong = useMemo(() => {
    if (!currentSong) return null;
    const currentIdx = songs.findIndex((song) => song.songId === currentSong.songId);
    const nextSong = songs.slice(currentIdx + 1).find((song) => song.stacked && song.renderPlan);
    if (!nextSong) return currentSong;
    if (currentSong.startedAt == null) return currentSong;
    const timeIntoSong = progressClock - currentSong.startedAt;
    const triggerAt = currentSong.durationSec * 1000 - TRANSITION_LEAD_MS;
    return timeIntoSong < triggerAt ? currentSong : nextSong;
  }, [currentSong, songs, progressClock]);

  const model = useMemo(
    () => (displayedSong ? buildDialViewModelFromSong(displayedSong) : null),
    [displayedSong],
  );
  const modelSongId = model?.songId ?? null;
  const locationOptionIds = useMemo(
    () => model?.locationOptions.map((option) => option.id) ?? [],
    [model],
  );
  const activityOptionIds = useMemo(
    () => model?.activityOptions.map((option) => option.id) ?? [],
    [model],
  );
  const selectedLocationId = model?.locationOptions[0]?.id ?? (model?.coordsLabel ? `coords:${model.coordsLabel}` : null);
  const selectedActivityId = model?.activityOptions[0]?.id ?? null;
  const locationTurn = useShortestDialTurn(selectedLocationId, locationOptionIds, 'location');
  const activityTurn = useShortestDialTurn(selectedActivityId, activityOptionIds, 'activity');

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!isPaused) setProgressClock(performance.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  useEffect(() => {
    if (!analyser) {
      setMusicOrbLevel(0);
      return;
    }
    const buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    const timer = window.setInterval(() => {
      if (!isPlaying) {
        setMusicOrbLevel((current) => (current > 0.01 ? current * 0.7 : 0));
        return;
      }
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const sample of buffer) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / buffer.length);
      const nextLevel = clamp01(rms * 4.8);
      setMusicOrbLevel((current) =>
        Math.abs(current - nextLevel) < 0.01 ? current : current * 0.55 + nextLevel * 0.45,
      );
    }, 80);
    return () => window.clearInterval(timer);
  }, [analyser, isPlaying]);

  useEffect(() => {
    if (!modelSongId) return;
    // Fire the overlay on every model song change, including the first
    // reveal. React's effect identity is keyed on [modelSongId] so this only
    // runs when the song actually changes, not on every render.
    setOverlayActive(true);
    onOverlayChange?.(true);
    const hideTimer = window.setTimeout(() => {
      setOverlayActive(false);
      onOverlayChange?.(false);
    }, OVERLAY_DURATION_MS);
    return () => window.clearTimeout(hideTimer);
  }, [modelSongId, onOverlayChange]);

  if (!model) {
    return <WaitingDial />;
  }

  // Ring completes at the moment the audio crossfade *begins*, not at the
  // audio engine's swap event (end of crossfade). That way the user sees the
  // ring hit 100% exactly as the new song starts fading in — which is what
  // they perceive as "the songs switching from one to another". After that,
  // the ring sits at 100% for AUDIO_RAMP_SEC while the crossfade plays out,
  // and resets to 0 when currentSongId flips to the new song.
  const effectiveDurationSec = Math.max(1, currentSong ? currentSong.durationSec - AUDIO_RAMP_SEC : 0);
  const playbackProgress =
    currentSong?.startedAt != null && isPlaying
      ? clamp01((progressClock - currentSong.startedAt - pauseOffsetMsRef.current) / (effectiveDurationSec * 1000))
      : null;
  const musicProgressMode: MusicProgressMode = playbackProgress != null ? 'playback' : 'idle';
  const musicProgressValue = playbackProgress ?? 0;

  const hourAngle = hourToAngle(model.hour);
  const sunPoint = pointOnOrbit(hourAngle, SUN_ORBIT_RADIUS);
  const sunrisePoint = pointOnOrbit(hourToAngle(model.sunriseHour), SUN_ORBIT_RADIUS);
  const sunsetPoint = pointOnOrbit(hourToAngle(model.sunsetHour), SUN_ORBIT_RADIUS);
  // Fall back to the user's coordinates when classification + reverse-geocode
  // came up empty. Coordinates are truthful and non-redundant with the time
  // phase shown near the sun indicator.
  const topButtonLabel = model.locationOptions[0]?.label || model.coordsLabel;
  const bottomButtonLabel = model.activityOptions[0]?.label ?? '';
  // Top-of-dial readouts: 4 centered lines that sit between the cloud icon and
  // the dial outer ring. Built from the same model fields as the dial body.
  const weatherReadout = [model.weatherLabel, model.tempLabel].filter(Boolean).join(' / ')
    || [model.phaseLabel, model.dayOfWeek].filter(Boolean).join(' / ');
  const motionReadout = model.motionLabel;
  const musicReadout = [`${model.bpm} BPM`, model.key].filter(Boolean).join(' / ');
  const topMood = model.moodTags[0]?.toUpperCase() ?? '';
  const placeMoodReadout = [model.placeLabel || model.coordsLabel, topMood].filter(Boolean).join(' / ');

  return (
    <section
      className={`phone-dial ${model.isNight ? 'phone-dial--night' : ''}`}
      aria-label="Hero Syndrome dial"
      data-orb-colors={model.orbColors.join(',')}
      data-progress-mode={musicProgressMode}
      data-overlay={overlayActive ? 'active' : 'idle'}
      style={{ '--light-level': model.lightLevel.toFixed(3) } as CSSProperties}
    >
      <svg
        aria-label={`Dial state: ${model.phaseLabel}, ${formatHour(model.hour)}`}
        className={`phone-dial__artboard ${model.isNight ? 'phone-dial__artboard--night' : ''} ${overlayActive ? 'phone-dial__artboard--selection-open' : ''}`}
        preserveAspectRatio="xMidYMid slice"
        role="img"
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      >
        <defs>
          <linearGradient id="journeyBackground" x1="196.5" x2="196.5" y1="0" y2="852" gradientUnits="userSpaceOnUse">
            <stop stopColor={model.isNight ? '#0e1432' : '#7ab3dc'} />
            <stop offset="0.45" stopColor={model.isNight ? '#1a2148' : '#b9d6ec'} />
            <stop offset="1" stopColor={model.isNight ? '#04071a' : '#d6e5f1'} />
          </linearGradient>
          <path id="topSelectionArc" d={arcPath(BUTTON_TEXT_RADIUS, 0, BUTTON_ARC_SPAN - 8)} />
          <path id="topMaterialArc" d={arcPath(TOP_MATERIAL_LABEL_RADIUS, 0, 82)} />
          <path id="bottomMaterialArc" d={bottomArcPath(BOTTOM_MATERIAL_LABEL_RADIUS, 180, 82)} />
          <path id="bottomSelectionArc" d={bottomArcPath(BUTTON_TEXT_RADIUS, 180, BUTTON_ARC_SPAN - 8)} />
          <filter id="backgroundTone" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0.45" />
          </filter>
          {/* Cloud highlight overlay: bright at top + bottom of the frame,
              transparent through the middle. Layered over the desaturated
              background image during daytime cloudy weather to read like a
              real sky with cloud banks wrapping the horizon. */}
          <linearGradient id="cloudHighlight" x1="196.5" x2="196.5" y1="0" y2="852" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="0.14" stopColor="#ffffff" stopOpacity="0.38" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.85" stopColor="#ffffff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.7" />
          </linearGradient>
          {/* Clip horizon line to only the region outside the outer ring circle */}
          <clipPath id="horizonLineClip" clipPathUnits="userSpaceOnUse">
            <path
              fillRule="evenodd"
              d={`M0,0 H${FRAME.width} V${FRAME.height} H0 Z M${DIAL_CENTER.x - OUTER_RADIUS},${DIAL_CENTER.y} a${OUTER_RADIUS},${OUTER_RADIUS} 0 1,0 ${OUTER_RADIUS * 2},0 a${OUTER_RADIUS},${OUTER_RADIUS} 0 1,0 ${-OUTER_RADIUS * 2},0`}
            />
          </clipPath>
        </defs>

        <rect width={FRAME.width} height={FRAME.height} fill="url(#journeyBackground)" />
        {model.isNight ? (
          <image
            href={ASSETS.background}
            filter="url(#backgroundTone)"
            height="1399"
            opacity="0.16"
            preserveAspectRatio="xMidYMid slice"
            width="1670"
            x="-660"
            y="-282"
          />
        ) : null}
        <rect
          width={FRAME.width}
          height={FRAME.height}
          fill={model.isNight ? '#0c1027' : '#7eaed6'}
          opacity={model.isNight ? '0.58' : '0'}
        />
        {!model.isNight && isCloudyCondition(model.weatherCondition) ? (
          <rect width={FRAME.width} height={FRAME.height} fill="url(#cloudHighlight)" />
        ) : null}

        {model.isNight && (
          <g className="phone-dial__stars">
            <circle cx="62" cy="107" r="1.2" />
            <circle cx="307" cy="143" r="1" />
            <circle cx="335" cy="295" r="1.3" />
            <circle cx="92" cy="704" r="1" />
            <circle cx="289" cy="652" r="1.1" />
            <circle cx="214" cy="190" r="0.9" />
          </g>
        )}
        <WeatherIcon condition={model.weatherCondition} isNight={model.isNight} />

        <line
          className="phone-dial__horizon-line"
          clipPath="url(#horizonLineClip)"
          x1={sunrisePoint.x}
          x2={sunsetPoint.x}
          y1={sunrisePoint.y}
          y2={sunsetPoint.y}
        />
        <image href={ASSETS.outerRing} height="379" width="379" x="8" y="236.5" />
        <MusicProgressRing
          mode={musicProgressMode}
          progress={musicProgressValue}
          songKey={currentSong?.songId ?? 'idle'}
          startAngle={hourToAngle(model.sunriseHour)}
        />
        <circle
          className="phone-dial__sun-orbit"
          cx={DIAL_CENTER.x}
          cy={DIAL_CENTER.y}
          fill="none"
          r={SUN_ORBIT_RADIUS}
        />
        <g className="phone-dial__horizon-marker">
          <circle cx={sunrisePoint.x} cy={sunrisePoint.y} r="3" />
          <circle cx={sunsetPoint.x} cy={sunsetPoint.y} r="3" />
          <text x={sunrisePoint.x + 5} y={sunrisePoint.y - 8}>
            {formatHour(model.sunriseHour).slice(0, 2)}
          </text>
          <text textAnchor="end" x={sunsetPoint.x - 5} y={sunsetPoint.y - 8}>
            {formatHour(model.sunsetHour).slice(0, 2)}
          </text>
        </g>

        <ClockMarks />

        {model.isNight ? (
          <MoonIndicator phase={model.moonPhase} x={sunPoint.x} y={sunPoint.y} />
        ) : (
          <SunIndicator x={sunPoint.x} y={sunPoint.y} />
        )}

        <image
          href={ASSETS.innerRing}
          height="161"
          width="160"
          x={DIAL_CENTER.x - 80}
          y={DIAL_CENTER.y - 80.5}
        />
        <image
          href={ASSETS.innerCore}
          height="83"
          width="83"
          x={DIAL_CENTER.x - 41.5}
          y={DIAL_CENTER.y - 41.5}
        />
        <OrbBezel />

        <g
          aria-label={`Place: ${topButtonLabel}`}
          className="phone-dial__arc-button phone-dial__arc-button--readonly phone-dial__arc-button--turning"
          key={locationTurn.key}
          style={locationTurn.style}
        >
          <path
            className="phone-dial__button-arc-fill"
            d={annularArcPath(BUTTON_INNER_RADIUS, BUTTON_OUTER_RADIUS, 0, BUTTON_ARC_SPAN)}
          />
          <text className="phone-dial__selection-label">
            <textPath href="#topSelectionArc" startOffset="50%" textAnchor="middle">
              {topButtonLabel}
            </textPath>
          </text>
        </g>

        {model.materialLabel ? (
          <text className="phone-dial__material-label">
            <textPath href="#topMaterialArc" startOffset="50%" textAnchor="middle">
              {model.materialLabel}
            </textPath>
          </text>
        ) : null}
        {model.forceLabel ? (
          <text className="phone-dial__material-label phone-dial__material-label--bottom">
            <textPath href="#bottomMaterialArc" startOffset="50%" textAnchor="middle">
              {model.forceLabel}
            </textPath>
          </text>
        ) : null}

        <g
          aria-label={`Activity: ${bottomButtonLabel}`}
          className="phone-dial__arc-button phone-dial__arc-button--readonly phone-dial__arc-button--turning"
          key={activityTurn.key}
          style={activityTurn.style}
        >
          <path
            className="phone-dial__button-arc-fill"
            d={annularArcPath(BUTTON_INNER_RADIUS, BUTTON_OUTER_RADIUS, 180, BUTTON_ARC_SPAN)}
          />
          <text className="phone-dial__run-label">
            <textPath href="#bottomSelectionArc" startOffset="50%" textAnchor="middle">
              {bottomButtonLabel}
            </textPath>
          </text>
        </g>

        <g className="phone-dial__data-readouts phone-dial__data-readouts--top">
          <text x={DIAL_CENTER.x} y={138} textAnchor="middle">{weatherReadout}</text>
          <text x={DIAL_CENTER.x} y={158} textAnchor="middle">{motionReadout}</text>
          <text x={DIAL_CENTER.x} y={178} textAnchor="middle">{musicReadout}</text>
          <text x={DIAL_CENTER.x} y={198} textAnchor="middle">{placeMoodReadout}</text>
        </g>
      </svg>
      <CenterOrb
        colors={ORB_COLORS}
        isMusicPlaying={isPlaying && !isPaused}
        musicLevel={musicOrbLevel}
        seed={model.bpm + (model.locationOptions[0]?.label.length ?? 0)}
        isPaused={isPaused}
        onClick={onOrbClick}
      />
      {overlayActive ? <SelectionOverlay model={model} /> : null}
    </section>
  );
}
