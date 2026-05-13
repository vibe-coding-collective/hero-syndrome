import type { CSSProperties } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  weatherCloud: '/prototype-dial/weather-cloud.svg',
  selectionControlRing: '/prototype-dial/selection-control-ring.svg',
  selectionDashRing: '/prototype-dial/selection-dash-ring.svg',
  selectionInnerRing: '/prototype-dial/selection-inner-ring.svg',
  selectionInnerCore: '/prototype-dial/selection-inner-core.svg',
  selectionLine: '/prototype-dial/selection-line.svg',
  selectionPointer: '/prototype-dial/selection-pointer.svg',
} as const;

const FRAME = { width: 393, height: 852 };
const DIAL_CENTER = { x: 197, y: 426 };
const CENTER_ORB_SIZE = 111;
const ORB_BEZEL_INNER_RADIUS = CENTER_ORB_SIZE / 2 - 1.5;
const ORB_BEZEL_OUTER_RADIUS = 80.5;
const SUN_ORBIT_RADIUS = 147;
const OUTER_RADIUS = 181;
const MUSIC_PROGRESS_RADIUS = OUTER_RADIUS - 6;
const TOP_MATERIAL_LABEL_RADIUS = 66;
const BOTTOM_MATERIAL_LABEL_RADIUS = 66;
const LOCATION_LABEL_RADIUS = 119;
const BUTTON_INNER_RADIUS = 72;
const BUTTON_OUTER_RADIUS = 96;
const BUTTON_TEXT_RADIUS = 84;
const BUTTON_ARC_SPAN = 92;
const SELECTION_CONTROL_RING_SIZE = 213;
const SELECTION_POINTER = { width: 85.336, height: 111.5 };
/** Total window the song-boundary overlay is mounted for, in ms. The CSS
 *  animations in `phone-dial__location-overlay` and `phone-dial__location-list`
 *  must sum to this duration. The wheel transition fires at
 *  TRANSITION_LEAD_MS before the current song ends so it completes exactly at
 *  the song boundary (audio crossfade is 5s wide; visuals run the back half). */
const OVERLAY_DURATION_MS = 2500;
const TRANSITION_LEAD_MS = 2500;

type MusicProgressMode = 'idle' | 'loading' | 'playback';

interface DiskUiPrototypeProps {
  /** AnalyserNode from the parent AudioEngine. When present and audio is
   *  playing, drives the Orb's reactive level. */
  analyser: AnalyserNode | null;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
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

function readableArcPath(radius: number, midAngle: number, span = 20): string {
  const normalized = normalizeDegrees(midAngle);
  if (normalized > 90 && normalized < 270) return bottomArcPath(radius, midAngle, span);
  return arcPath(radius, midAngle, span);
}

function ringPath(radius: number, startAngle: number, span: number, shouldClose = false): string {
  const segmentCount = Math.max(2, Math.ceil(Math.abs(span) / 4));
  const points = Array.from({ length: segmentCount + 1 }, (_, index) => {
    const angle = startAngle + span * (index / segmentCount);
    return pointOnOrbit(angle, radius);
  });
  const [first, ...rest] = points;

  return [
    `M ${first!.x.toFixed(3)} ${first!.y.toFixed(3)}`,
    ...rest.map((point) => `L ${point.x.toFixed(3)} ${point.y.toFixed(3)}`),
    shouldClose ? 'Z' : '',
  ].join(' ');
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

function progressArcPath(radius: number, startAngle: number, progress: number): string {
  const span = Math.max(0.1, Math.min(359.9, clamp01(progress) * 359.9));
  return ringPath(radius, startAngle, span);
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

function MusicProgressRing(props: {
  mode: MusicProgressMode;
  progress: number;
  startAngle: number;
}) {
  const clampedProgress = clamp01(props.progress);
  const trackPath = ringPath(MUSIC_PROGRESS_RADIUS, props.startAngle, 360, true);
  const fillPath = progressArcPath(MUSIC_PROGRESS_RADIUS, props.startAngle, clampedProgress);

  return (
    <g
      aria-label={`Music progress: ${Math.round(clampedProgress * 100)} percent`}
      className={`phone-dial__music-progress phone-dial__music-progress--${props.mode}`}
      role="img"
    >
      <path className="phone-dial__music-progress-backing" d={trackPath} fill="none" />
      <path className="phone-dial__music-progress-track" d={trackPath} fill="none" />
      {props.mode !== 'idle' ? (
        <path className="phone-dial__music-progress-fill" d={fillPath} fill="none" />
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
}) {
  const orbState = props.isMusicPlaying ? 'talking' : null;
  const orbKey = `${orbState ?? 'idle'}-${props.colors[0]}-${props.colors[1]}-${props.seed}`;
  const levelRef = useRef(props.musicLevel);
  levelRef.current = props.musicLevel;

  return (
    <div className="phone-dial__orb-layer" aria-hidden>
      <div className="phone-dial__orb-shell">
        <Orb
          agentState={orbState}
          className="phone-dial__orb-canvas"
          colors={props.colors}
          getOutputVolume={() => levelRef.current}
          key={orbKey}
          seed={props.seed}
          volumeMode="manual"
        />
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
      <circle
        className="phone-dial__orb-bezel-inner-edge"
        cx={DIAL_CENTER.x}
        cy={DIAL_CENTER.y}
        fill="none"
        r={ORB_BEZEL_INNER_RADIUS}
      />
    </g>
  );
}

function NightWeatherIcon() {
  return (
    <g className="phone-dial__night-weather" transform="translate(151 48)">
      <circle cx="47" cy="27" r="25" />
      <circle className="phone-dial__moon-cutout" cx="57" cy="20" r="25" />
      <circle className="phone-dial__star" cx="12" cy="15" r="1.7" />
      <circle className="phone-dial__star" cx="80" cy="10" r="1.2" />
      <circle className="phone-dial__star" cx="89" cy="42" r="1.4" />
      <path d="M12 47C16 36 27 31 38 35C43 27 56 29 61 38C71 37 80 43 81 54H12Z" />
    </g>
  );
}

function MoonIndicator(props: { x: number; y: number }) {
  return (
    <g
      className="phone-dial__moon-indicator phone-dial__celestial-indicator"
      transform={`translate(${props.x - 39} ${props.y - 39})`}
    >
      <circle className="phone-dial__moon-glow" cx="39" cy="39" r="34" />
      <circle className="phone-dial__moon-disc" cx="39" cy="39" r="22" />
      <circle className="phone-dial__moon-shadow" cx="49" cy="31" r="23" />
      <circle className="phone-dial__moon-speck" cx="31" cy="31" r="2.3" />
      <circle className="phone-dial__moon-speck" cx="43" cy="48" r="1.7" />
      <circle className="phone-dial__moon-speck" cx="33" cy="51" r="1.2" />
    </g>
  );
}

function SunIndicator(props: { x: number; y: number }) {
  return (
    <g
      className="phone-dial__sun-indicator phone-dial__celestial-indicator"
      transform={`translate(${props.x - 39} ${props.y - 39})`}
    >
      <circle className="phone-dial__sun-glow" cx="39" cy="39" r="34" />
      <circle className="phone-dial__sun-disc" cx="39" cy="39" r="23" />
      <g className="phone-dial__sun-grain">
        {Array.from({ length: 52 }).map((_, index) => {
          const angle = (index * 137.5) % 360;
          const radius = 4 + ((index * 11) % 19);
          const point = {
            x: 39 + Math.cos((angle * Math.PI) / 180) * radius,
            y: 39 + Math.sin((angle * Math.PI) / 180) * radius,
          };
          return <circle cx={point.x} cy={point.y} key={index} r={index % 3 === 0 ? 0.8 : 0.55} />;
        })}
      </g>
    </g>
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

export default function DiskUiPrototype({ analyser }: DiskUiPrototypeProps) {
  const songs = useStore((state) => state.songs);
  const currentSongId = useStore((state) => state.currentSongId);
  const isPlaying = useStore((state) => state.isPlaying);
  const [progressClock, setProgressClock] = useState(() => performance.now());
  const [musicOrbLevel, setMusicOrbLevel] = useState(0);
  const [overlayActive, setOverlayActive] = useState(false);

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

  useEffect(() => {
    const timer = window.setInterval(() => setProgressClock(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

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
    const hideTimer = window.setTimeout(() => setOverlayActive(false), OVERLAY_DURATION_MS);
    return () => window.clearTimeout(hideTimer);
  }, [modelSongId]);

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
      ? clamp01((progressClock - currentSong.startedAt) / (effectiveDurationSec * 1000))
      : null;
  const musicProgressMode: MusicProgressMode = playbackProgress != null ? 'playback' : 'idle';
  const musicProgressValue = playbackProgress ?? 0;

  const hourAngle = hourToAngle(model.hour);
  const stateTextAngle = normalizeDegrees(hourAngle - 38);
  const sunPoint = pointOnOrbit(hourAngle, SUN_ORBIT_RADIUS);
  const sunrisePoint = pointOnOrbit(hourToAngle(model.sunriseHour), SUN_ORBIT_RADIUS);
  const sunsetPoint = pointOnOrbit(hourToAngle(model.sunsetHour), SUN_ORBIT_RADIUS);
  // Fall back to the user's coordinates when classification + reverse-geocode
  // came up empty. Coordinates are truthful and non-redundant with the time
  // phase shown near the sun indicator.
  const topButtonLabel = model.locationOptions[0]?.label || model.coordsLabel;
  const bottomButtonLabel = model.activityOptions[0]?.label ?? '';
  // Top readout line: weather + temp, or phase + day-of-week as fallback.
  const topReadout = [model.weatherLabel, model.tempLabel].filter(Boolean).join(' / ')
    || [model.phaseLabel, model.dayOfWeek].filter(Boolean).join(' / ');
  const bottomReadout = [model.placeLabel || model.coordsLabel, `${model.bpm} BPM`, model.key].filter(Boolean).join(' / ');

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
        role="img"
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      >
        <defs>
          <linearGradient id="journeyBackground" x1="196.5" x2="196.5" y1="0" y2="852" gradientUnits="userSpaceOnUse">
            <stop stopColor={model.isNight ? '#121833' : '#90B5D0'} />
            <stop offset="0.52" stopColor={model.isNight ? '#22254a' : '#c7d8e3'} />
            <stop offset="1" stopColor={model.isNight ? '#060918' : '#FFFFFF'} />
          </linearGradient>
          <path id="stateTextArc" d={readableArcPath(OUTER_RADIUS - 6, stateTextAngle, 62)} />
          <path id="topSelectionArc" d={arcPath(BUTTON_TEXT_RADIUS, 0, BUTTON_ARC_SPAN - 8)} />
          <path id="topMaterialArc" d={arcPath(TOP_MATERIAL_LABEL_RADIUS, 0, 64)} />
          <path id="bottomMaterialArc" d={bottomArcPath(BOTTOM_MATERIAL_LABEL_RADIUS, 180, 82)} />
          <path id="bottomSelectionArc" d={bottomArcPath(BUTTON_TEXT_RADIUS, 180, BUTTON_ARC_SPAN - 8)} />
          <filter id="backgroundTone" colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0.05" />
          </filter>
        </defs>

        <rect width={FRAME.width} height={FRAME.height} fill="url(#journeyBackground)" />
        <image
          href={ASSETS.background}
          filter="url(#backgroundTone)"
          height="1399"
          opacity={model.isNight ? '0.22' : '0.86'}
          preserveAspectRatio="xMidYMid slice"
          width="1670"
          x="-660"
          y="-282"
        />
        <rect
          width={FRAME.width}
          height={FRAME.height}
          fill={model.isNight ? '#0c1027' : '#90B5D0'}
          opacity={model.isNight ? '0.62' : '0.45'}
        />

        {model.isNight ? (
          <>
            <g className="phone-dial__stars">
              <circle cx="62" cy="107" r="1.2" />
              <circle cx="307" cy="143" r="1" />
              <circle cx="335" cy="295" r="1.3" />
              <circle cx="92" cy="704" r="1" />
              <circle cx="289" cy="652" r="1.1" />
              <circle cx="214" cy="190" r="0.9" />
            </g>
            <NightWeatherIcon />
          </>
        ) : (
          <image href={ASSETS.weatherCloud} height="46" width="86" x="153.5" y="54.25" />
        )}

        <image href={ASSETS.outerRing} height="379" width="379" x="8" y="236.5" />
        <MusicProgressRing
          mode={musicProgressMode}
          progress={musicProgressValue}
          startAngle={hourToAngle(model.sunriseHour)}
        />
        <circle
          className="phone-dial__sun-orbit"
          cx={DIAL_CENTER.x}
          cy={DIAL_CENTER.y}
          fill="none"
          r={SUN_ORBIT_RADIUS}
        />
        <line
          className="phone-dial__horizon-line"
          x1={sunrisePoint.x}
          x2={sunsetPoint.x}
          y1={sunrisePoint.y}
          y2={sunsetPoint.y}
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

        <text className="phone-dial__state-label">
          <textPath href="#stateTextArc" startOffset="50%" textAnchor="middle">
            {model.phaseLabel}
          </textPath>
        </text>

        {model.isNight ? <MoonIndicator x={sunPoint.x} y={sunPoint.y} /> : <SunIndicator x={sunPoint.x} y={sunPoint.y} />}

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
          className="phone-dial__arc-button phone-dial__arc-button--readonly"
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
          className="phone-dial__arc-button phone-dial__arc-button--readonly"
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

        <g className="phone-dial__data-readouts">
          <text x="25" y="710">{topReadout}</text>
          <text x="25" y="728">{model.motionLabel}</text>
          <text x="25" y="746">{bottomReadout}</text>
        </g>
      </svg>
      <CenterOrb
        colors={model.orbColors}
        isMusicPlaying={isPlaying}
        musicLevel={musicOrbLevel}
        seed={model.bpm + (model.locationOptions[0]?.label.length ?? 0)}
      />
      {overlayActive ? <SelectionOverlay model={model} /> : null}
    </section>
  );
}
