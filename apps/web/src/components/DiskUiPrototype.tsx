import { type PointerEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { StateVector } from '@hero-syndrome/shared';
import { dialDemoSnapshots } from '../data/dynamicDialDemo';
import { GeolocationSensor } from '../sensors/geolocation';
import { MotionSensor } from '../sensors/motion';
import { StateAggregator } from '../state/aggregator';
import { useStore } from '../state/store';
import { snapshotFromStateVector } from '../prototype/dialDataAdapter';
import {
  buildCompositionReadyPackage,
  buildDialViewModel,
  type DialOption,
  type DialOptionKind,
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
  selectionSun: '/prototype-dial/selection-sun.svg',
} as const;

const FRAME = { width: 393, height: 852 };
const DIAL_CENTER = { x: 197, y: 426 };
const CENTER_ORB_SIZE = 111;
const CENTER_ORB_CLIP_RADIUS = CENTER_ORB_SIZE / 2 - 0.5;
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

const DEMO_SNAPSHOT = dialDemoSnapshots[0]!;
const INITIAL_MODEL = buildDialViewModel(DEMO_SNAPSHOT);
const ENABLE_DIAL_MUSIC_GENERATION = false;

interface SelectionDrag {
  startPointerAngle: number;
  startRotation: number;
}

type LiveDataStatus = 'demo' | 'starting' | 'live' | 'error';
type MusicProgressMode = 'idle' | 'loading' | 'playback';
type SimulationKind = 'day' | 'night';
type SimulationStatus = 'idle' | 'loading' | 'playing' | 'missing' | 'blocked' | 'complete';

interface LiveDataRuntime {
  aggregator: StateAggregator;
  geolocation: GeolocationSensor;
  motion: MotionSensor;
}

interface SimulatedPlayback {
  kind: SimulationKind | null;
  status: SimulationStatus;
  label: string;
  startedAt: number | null;
  durationSec: number;
}

type AudioContextWindow = Window & { webkitAudioContext?: typeof AudioContext };

const SIMULATION_AUDIO: Record<SimulationKind, string> = {
  day: '/prototype-dial/audio/day-demo.mp3',
  night: '/prototype-dial/audio/night-demo.mp3',
};

const SIMULATION_STATE_VECTORS: Record<SimulationKind, StateVector> = {
  day: {
    timestamp: '2026-05-13T13:20:00+08:00',
    time: {
      hour: 13,
      phase: 'afternoon',
      dayOfWeek: 'Wednesday',
    },
    weather: {
      tempC: 28,
      feelsLikeC: 31,
      humidityPct: 68,
      condition: 'clear',
      precipitationMmHr: 0,
      cloudCoverPct: 18,
      windMps: 3.2,
      isDay: true,
      sunriseProximityMin: 440,
      sunsetProximityMin: -300,
    },
    location: {
      speedMps: 1.1,
      bodyActivity: 'walking',
      place: {
        category: 'amenity',
        type: 'cafe',
        name: 'Sun Room Cafe',
      },
      road: {
        class: 'pedestrian',
        name: 'Garden Walk',
      },
      nearby: [
        { category: 'leisure', type: 'park', name: 'Harbour Garden', distanceM: 34 },
        { category: 'amenity', type: 'cafe', name: 'Sun Room Cafe', distanceM: 8 },
        { category: 'shop', type: 'bakery', name: 'Morning Oven', distanceM: 52 },
        { category: 'tourism', type: 'gallery', name: 'White Wall Space', distanceM: 88 },
        { category: 'amenity', type: 'library', name: 'City Reading Room', distanceM: 132 },
        { category: 'leisure', type: 'fitness_centre', name: 'Midday Studio', distanceM: 166 },
        { category: 'railway', type: 'station', name: 'Central Station', distanceM: 248 },
        { category: 'shop', type: 'mall', name: 'Arcade Walk', distanceM: 310 },
      ],
      neighborhood: 'Central',
      city: 'Hong Kong',
      country: 'Hong Kong',
      countryCode: 'HK',
    },
    movement: {
      intensityNormalized: 0.36,
      pattern: 'steady',
    },
    cosmic: {
      spaceWeather: {
        kIndex: 2,
        solarWindSpeedKmS: 382,
        solarWindDensity: 4.8,
      },
    },
  },
  night: {
    timestamp: '2026-05-13T22:45:00+08:00',
    time: {
      hour: 22,
      phase: 'night',
      dayOfWeek: 'Wednesday',
    },
    weather: {
      tempC: 23,
      feelsLikeC: 25,
      humidityPct: 86,
      condition: 'rain',
      precipitationMmHr: 1.6,
      cloudCoverPct: 91,
      windMps: 5.4,
      isDay: false,
      sunriseProximityMin: 1000,
      sunsetProximityMin: 265,
    },
    location: {
      speedMps: 0.2,
      bodyActivity: 'still',
      place: {
        category: 'bar',
        type: 'bar',
        name: 'Low Light Room',
      },
      road: {
        class: 'residential',
        name: 'Mercury Lane',
      },
      nearby: [
        { category: 'amenity', type: 'bar', name: 'Low Light Room', distanceM: 10 },
        { category: 'amenity', type: 'restaurant', name: 'Night Kitchen', distanceM: 46 },
        { category: 'tourism', type: 'gallery', name: 'Blue Hour Gallery', distanceM: 74 },
        { category: 'shop', type: 'convenience', name: 'Late Store', distanceM: 96 },
        { category: 'railway', type: 'station', name: 'Tin Hau', distanceM: 164 },
        { category: 'leisure', type: 'park', name: 'Temple Garden', distanceM: 226 },
        { category: 'amenity', type: 'cafe', name: 'After Midnight', distanceM: 282 },
        { category: 'building', type: 'apartments', name: 'Mercury House', distanceM: 340 },
      ],
      neighborhood: 'Tin Hau',
      city: 'Hong Kong',
      country: 'Hong Kong',
      countryCode: 'HK',
    },
    movement: {
      intensityNormalized: 0.14,
      pattern: 'still',
    },
    cosmic: {
      spaceWeather: {
        kIndex: 4,
        solarWindSpeedKmS: 438,
        solarWindDensity: 7.1,
      },
    },
  },
};

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function signedDistanceFromNeedle(value: number): number {
  const normalized = normalizeDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

function selectedIndexForRotation(rotation: number, itemCount: number): number {
  const step = 360 / itemCount;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < itemCount; index += 1) {
    const distance = Math.abs(signedDistanceFromNeedle(rotation + index * step));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function snapRotationForIndex(index: number, itemCount: number): number {
  return -(index * (360 / itemCount));
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

function pointerAngle(event: PointerEvent<SVGElement>): number {
  const svg = event.currentTarget.ownerSVGElement ?? (event.currentTarget as SVGSVGElement);
  const rect = svg.getBoundingClientRect();
  const scaleX = FRAME.width / rect.width;
  const scaleY = FRAME.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  return (Math.atan2(x - DIAL_CENTER.x, -(y - DIAL_CENTER.y)) * 180) / Math.PI;
}

function hourFromPointer(event: PointerEvent<SVGElement>): number {
  return Math.round(normalizeDegrees(pointerAngle(event)) / 15 + 12) % 24;
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

function shortTail(value: string): string {
  return value.slice(Math.max(0, value.length - 3));
}

function shortHead(value: string): string {
  return value.slice(0, 3);
}

function affordanceLabel(options: DialOption[], index: number): string {
  const previous = options[(index - 1 + options.length) % options.length]?.label ?? '';
  const current = options[index]?.label ?? '';
  const next = options[(index + 1) % options.length]?.label ?? '';
  return `${shortTail(previous)} . ${current} . ${shortHead(next)}`;
}

function playDialTick(): void {
  const audioWindow = window as AudioContextWindow;
  const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioContextClass) return;

  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(760, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(260, audio.currentTime + 0.055);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.085, audio.currentTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.065);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.07);
  oscillator.onended = () => void audio.close();
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
      <path
        className="phone-dial__music-progress-backing"
        d={trackPath}
        fill="none"
      />
      <path
        className="phone-dial__music-progress-track"
        d={trackPath}
        fill="none"
      />
      {props.mode !== 'idle' ? (
        <path
          className="phone-dial__music-progress-fill"
          d={fillPath}
          fill="none"
        />
      ) : null}
    </g>
  );
}

function CenterOrb(props: {
  activity: DialOption;
  bpm: number;
  colors: [string, string];
  intensity: number;
  isMusicPlaying: boolean;
  musicLevel: number;
  seed: number;
}) {
  const rawClipId = useId();
  const clipId = `center-orb-clip-${rawClipId.replace(/:/g, '')}`;
  const orbState = props.isMusicPlaying ? 'talking' : null;
  const orbKey = `${orbState ?? 'idle'}-${props.colors[0]}-${props.colors[1]}-${props.seed}`;

  return (
    <g className="phone-dial__center-orb">
      <defs>
        <clipPath clipPathUnits="userSpaceOnUse" id={clipId}>
          <circle cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} r={CENTER_ORB_CLIP_RADIUS} />
        </clipPath>
      </defs>
      <foreignObject
        className="phone-dial__center-orb-object"
        clipPath={`url(#${clipId})`}
        height={CENTER_ORB_SIZE}
        width={CENTER_ORB_SIZE}
        x={DIAL_CENTER.x - CENTER_ORB_SIZE / 2}
        y={DIAL_CENTER.y - CENTER_ORB_SIZE / 2}
      >
        <div className="phone-dial__center-orb-shell">
          <Orb
            agentState={orbState}
            className="phone-dial__orb-canvas"
            colors={props.colors}
            key={orbKey}
            seed={props.seed}
            volumeMode="auto"
          />
        </div>
      </foreignObject>
    </g>
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
      <circle className="phone-dial__orb-bezel-inner-edge" cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="none" r={ORB_BEZEL_INNER_RADIUS} />
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
    <g className="phone-dial__moon-indicator" transform={`translate(${props.x - 39} ${props.y - 39})`}>
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
    <g className="phone-dial__sun-indicator" transform={`translate(${props.x - 39} ${props.y - 39})`}>
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

function SelectionOverlay(props: {
  kind: DialOptionKind;
  options: DialOption[];
  onClose: () => void;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  rotation: number;
  selectedIndex: number;
  orbColors: [string, string];
  intensity: number;
  bpm: number;
}) {
  const step = 360 / props.options.length;
  const selected = props.options[props.selectedIndex] ?? props.options[0]!;
  const selectedArcId = `${props.kind}-selected-arc`;

  return (
    <div className="phone-dial__location-overlay">
      <svg
        aria-label={`${props.kind} selection dial: ${selected.label}`}
        className="phone-dial__location-artboard"
        onPointerCancel={props.onPointerUp}
        onPointerDown={props.onPointerDown}
        onPointerMove={props.onPointerMove}
        onPointerUp={props.onPointerUp}
        role="img"
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      >
        <defs>
          <path id={selectedArcId} d={arcPath(LOCATION_LABEL_RADIUS, 0, Math.min(48, step * 0.92))} />
        </defs>

        <image href={ASSETS.selectionLine} height="1" opacity="0.4" width="407" x="-10" y={DIAL_CENTER.y} />
        <image href={ASSETS.selectionDashRing} height="330" opacity="0.9" width="330" x="31.5" y="261" />
        <image href={ASSETS.selectionSun} height="78" width="78" x="18" y="298" />

        <image href={ASSETS.selectionInnerRing} height="161" width="160" x={DIAL_CENTER.x - 80} y={DIAL_CENTER.y - 80.5} />
        <image href={ASSETS.selectionInnerCore} height="83" width="83" x={DIAL_CENTER.x - 41.5} y={DIAL_CENTER.y - 41.5} />
        <CenterOrb
          activity={selected}
          bpm={props.bpm}
          colors={props.orbColors}
          intensity={props.intensity}
          isMusicPlaying={false}
          musicLevel={0}
          seed={props.bpm + selected.id.length}
        />
        <OrbBezel />

        <g className="phone-dial__location-list">
          {props.options.map((option, index) => {
            const angle = normalizeDegrees(index * step + props.rotation);
            const pathId = `${props.kind}-option-${index}`;
            const separatorPathId = `${pathId}-separator`;
            return (
              <g className={index === props.selectedIndex ? 'is-selected' : undefined} key={option.id}>
                <defs>
                  <path id={pathId} d={arcPath(119, angle, Math.min(42, step * 0.86))} />
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
        <g
          aria-label={`Confirm ${props.kind}: ${selected.label}`}
          className="phone-dial__location-confirm"
          onPointerDown={(event) => {
            event.stopPropagation();
            props.onClose();
          }}
          role="button"
        >
          <rect className="phone-dial__confirm-hit-area" height="140" width="112" x={DIAL_CENTER.x - 56} y={DIAL_CENTER.y - LOCATION_LABEL_RADIUS - 22} />
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

export default function DiskUiPrototype() {
  const runtimeRef = useRef<LiveDataRuntime | null>(null);
  const simulationAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioAnalysisDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const simulationTimerRef = useRef<number | null>(null);
  const simulationRunRef = useRef(0);
  const liveStateVector = useStore((state) => state.stateVector);
  const permissionsGranted = useStore((state) => state.permissionsGranted);
  const songs = useStore((state) => state.songs);
  const currentSongId = useStore((state) => state.currentSongId);
  const isPlaying = useStore((state) => state.isPlaying);
  const generationLatencyEMA = useStore((state) => state.generationLatencyEMA);
  const [progressClock, setProgressClock] = useState(() => performance.now());
  const [backgroundBusyUntil, setBackgroundBusyUntil] = useState(0);
  const [backgroundBusyStartedAt, setBackgroundBusyStartedAt] = useState(0);
  const [musicOrbLevel, setMusicOrbLevel] = useState(0);
  const [simulationKind, setSimulationKind] = useState<SimulationKind | null>(null);
  const [simulatedPlayback, setSimulatedPlayback] = useState<SimulatedPlayback>({
    kind: null,
    status: 'idle',
    label: 'LOCAL MUSIC',
    startedAt: null,
    durationSec: 30,
  });
  const [hourOverride, setHourOverride] = useState<number | null>(null);
  const [liveDataStatus, setLiveDataStatus] = useState<LiveDataStatus>('demo');
  const [activeOverlay, setActiveOverlay] = useState<DialOptionKind | null>(null);
  const [selectionDrag, setSelectionDrag] = useState<SelectionDrag | null>(null);
  const [overlayRotation, setOverlayRotation] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState(INITIAL_MODEL.locationOptions[0]!.id);
  const [selectedActivityId, setSelectedActivityId] = useState(INITIAL_MODEL.activityOptions[0]!.id);

  const simulatedStateVector = simulationKind ? SIMULATION_STATE_VECTORS[simulationKind] : null;
  const activeStateVector = simulatedStateVector ?? liveStateVector;
  const snapshot = useMemo(
    () => (activeStateVector ? snapshotFromStateVector(activeStateVector, DEMO_SNAPSHOT) : DEMO_SNAPSHOT),
    [activeStateVector],
  );
  const model = useMemo(() => buildDialViewModel(snapshot, hourOverride ?? undefined), [hourOverride, snapshot]);
  const dataSourceLabel = simulationKind ? `${simulationKind.toUpperCase()} SIM` : liveStateVector ? 'LIVE DATA' : 'DEMO DATA';
  const liveControlLabel = liveDataStatus === 'starting'
    ? 'STARTING DATA'
    : liveStateVector
      ? 'LIVE DATA ON'
      : liveDataStatus === 'error'
        ? 'DATA ERROR'
        : 'START DATA';
  const permissionLabel = `${permissionsGranted.motion ? 'MOTION' : 'NO MOTION'} / ${permissionsGranted.geolocation ? 'GPS' : 'NO GPS'}`;

  useEffect(() => {
    return () => {
      stopSimulatedAudio(false);
      runtimeRef.current?.aggregator.stop();
      runtimeRef.current?.motion.stop();
      runtimeRef.current?.geolocation.stop();
      runtimeRef.current = null;
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setProgressClock(performance.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const analyser = audioAnalyserRef.current;
      const data = audioAnalysisDataRef.current;
      if (!analyser || !data || simulatedPlayback.status !== 'playing') {
        setMusicOrbLevel((current) => (current > 0.01 ? current * 0.7 : 0));
        return;
      }

      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      const nextLevel = clamp01(rms * 4.8);
      setMusicOrbLevel((current) => (Math.abs(current - nextLevel) < 0.01 ? current : current * 0.55 + nextLevel * 0.45));
    }, 80);

    return () => window.clearInterval(timer);
  }, [simulatedPlayback.status]);

  useEffect(() => {
    if (!model.locationOptions.some((option) => option.id === selectedLocationId)) {
      setSelectedLocationId(model.locationOptions[0]!.id);
    }
  }, [model.locationOptions, selectedLocationId]);

  useEffect(() => {
    if (!model.activityOptions.some((option) => option.id === selectedActivityId)) {
      setSelectedActivityId(model.activityOptions[0]!.id);
    }
  }, [model.activityOptions, selectedActivityId]);

  const selectedLocationIndex = Math.max(0, model.locationOptions.findIndex((option) => option.id === selectedLocationId));
  const selectedActivityIndex = Math.max(0, model.activityOptions.findIndex((option) => option.id === selectedActivityId));
  const selectedLocation = model.locationOptions[selectedLocationIndex] ?? model.locationOptions[0]!;
  const selectedActivity = model.activityOptions[selectedActivityIndex] ?? model.activityOptions[0]!;
  const compositionPackage = useMemo(
    () => buildCompositionReadyPackage(model, selectedLocation, selectedActivity, {
      musicEnabled: ENABLE_DIAL_MUSIC_GENERATION,
    }),
    [model, selectedActivity, selectedLocation],
  );

  const hourAngle = hourToAngle(model.hour);
  const stateTextAngle = normalizeDegrees(hourAngle - 38);
  const sunPoint = useMemo(() => pointOnOrbit(hourAngle, SUN_ORBIT_RADIUS), [hourAngle]);
  const sunrisePoint = useMemo(() => pointOnOrbit(hourToAngle(model.sunriseHour), SUN_ORBIT_RADIUS), [model.sunriseHour]);
  const sunsetPoint = useMemo(() => pointOnOrbit(hourToAngle(model.sunsetHour), SUN_ORBIT_RADIUS), [model.sunsetHour]);
  const topButtonLabel = affordanceLabel(model.locationOptions, selectedLocationIndex);
  const bottomButtonLabel = affordanceLabel(model.activityOptions, selectedActivityIndex);
  const currentSong = useMemo(
    () => (currentSongId ? songs.find((song) => song.songId === currentSongId) : songs.at(-1)) ?? null,
    [currentSongId, songs],
  );
  const simulatedPlaybackProgress = simulatedPlayback.status === 'playing' && simulatedPlayback.startedAt != null
    ? clamp01((progressClock - simulatedPlayback.startedAt) / (simulatedPlayback.durationSec * 1000))
    : null;
  const storePlaybackProgress = currentSong?.startedAt != null && isPlaying
    ? clamp01((progressClock - currentSong.startedAt) / (currentSong.durationSec * 1000))
    : null;
  const playbackProgress = simulatedPlaybackProgress ?? storePlaybackProgress;
  const musicGenerationPending = ENABLE_DIAL_MUSIC_GENERATION && !isPlaying && Boolean(liveStateVector);
  const simulationLoading = simulatedPlayback.status === 'loading';
  const backgroundWorkPending = liveDataStatus === 'starting' || simulationLoading || musicGenerationPending || progressClock < backgroundBusyUntil;
  const musicProgressMode: MusicProgressMode = playbackProgress != null
    ? 'playback'
    : backgroundWorkPending
      ? 'loading'
      : 'idle';
  const loadingPeriodMs = Math.max(8_000, Math.min(60_000, generationLatencyEMA || 60_000));
  const scheduledLoadingProgress = backgroundBusyStartedAt > 0 && backgroundBusyUntil > backgroundBusyStartedAt && progressClock < backgroundBusyUntil
    ? clamp01((progressClock - backgroundBusyStartedAt) / (backgroundBusyUntil - backgroundBusyStartedAt))
    : null;
  const musicProgressValue = musicProgressMode === 'playback'
    ? playbackProgress ?? 0
    : musicProgressMode === 'loading'
      ? scheduledLoadingProgress ?? (progressClock % loadingPeriodMs) / loadingPeriodMs
      : 0;
  const localMusicLabel = simulatedPlayback.kind ? simulatedPlayback.label : 'LOCAL MUSIC';
  const musicProgressLabel = musicProgressMode === 'playback'
    ? `${Math.round(musicProgressValue * 100)}%`
    : simulatedPlayback.status === 'missing'
      ? 'MISSING AUDIO'
      : simulatedPlayback.status === 'blocked'
        ? 'TAP AGAIN'
        : simulatedPlayback.status === 'complete'
          ? 'COMPLETE'
          : musicProgressMode.toUpperCase();
  const musicSourceLabel = simulatedPlayback.kind ? localMusicLabel : `MUSIC ${compositionPackage.generation.musicEnabled ? 'ON' : 'OFF'}`;
  const isMusicOrbPlaying = simulatedPlayback.status === 'playing' || isPlaying;
  const activeMusicOrbLevel = simulatedPlayback.status === 'playing' ? musicOrbLevel : isPlaying ? 0.42 : 0;
  const canStopMusic = simulatedPlayback.status === 'loading' || simulatedPlayback.status === 'playing';

  function activeOptions(): DialOption[] {
    return activeOverlay === 'activity' ? model.activityOptions : model.locationOptions;
  }

  function activeSelectedIndex(): number {
    return activeOverlay === 'activity' ? selectedActivityIndex : selectedLocationIndex;
  }

  function updateHourFromPointer(event: PointerEvent<SVGElement>): void {
    setHourOverride(hourFromPointer(event));
  }

  function handlePointerDown(event: PointerEvent<SVGElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateHourFromPointer(event);
  }

  function handlePointerMove(event: PointerEvent<SVGElement>): void {
    if (event.buttons !== 1) return;
    updateHourFromPointer(event);
  }

  function handlePointerUp(): void {
    return;
  }

  function openSelection(kind: DialOptionKind, event: PointerEvent<SVGGElement>): void {
    event.stopPropagation();
    const index = kind === 'activity' ? selectedActivityIndex : selectedLocationIndex;
    const itemCount = kind === 'activity' ? model.activityOptions.length : model.locationOptions.length;
    setOverlayRotation(snapRotationForIndex(index, itemCount));
    setSelectionDrag(null);
    setActiveOverlay(kind);
    playDialTick();
  }

  function updateSelection(nextRotation: number): void {
    if (!activeOverlay) return;
    const options = activeOptions();
    const nextIndex = selectedIndexForRotation(nextRotation, options.length);
    const nextOption = options[nextIndex];
    if (!nextOption) return;
    if (activeOverlay === 'activity') {
      setSelectedActivityId((current) => {
        if (current === nextOption.id) return current;
        playDialTick();
        return nextOption.id;
      });
    } else {
      setSelectedLocationId((current) => {
        if (current === nextOption.id) return current;
        playDialTick();
        return nextOption.id;
      });
    }
  }

  function handleSelectionPointerDown(event: PointerEvent<SVGSVGElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionDrag({
      startPointerAngle: pointerAngle(event),
      startRotation: overlayRotation,
    });
  }

  function handleSelectionPointerMove(event: PointerEvent<SVGSVGElement>): void {
    if (!selectionDrag) return;
    const nextRotation = selectionDrag.startRotation + pointerAngle(event) - selectionDrag.startPointerAngle;
    setOverlayRotation(nextRotation);
    updateSelection(nextRotation);
  }

  function handleSelectionPointerUp(): void {
    if (!selectionDrag) return;
    setOverlayRotation(snapRotationForIndex(activeSelectedIndex(), activeOptions().length));
    setSelectionDrag(null);
  }

  function closeSelectionOverlay(): void {
    setOverlayRotation(snapRotationForIndex(activeSelectedIndex(), activeOptions().length));
    setSelectionDrag(null);
    setActiveOverlay(null);
    playDialTick();
  }

  function disconnectAudioAnalysis(resetLevel = true): void {
    try {
      audioSourceRef.current?.disconnect();
    } catch {
      // The source may already be detached after an audio element is replaced.
    }
    try {
      audioAnalyserRef.current?.disconnect();
    } catch {
      // The analyser may already be detached after an audio element is replaced.
    }
    audioSourceRef.current = null;
    audioAnalyserRef.current = null;
    audioAnalysisDataRef.current = null;
    if (resetLevel) setMusicOrbLevel(0);
  }

  function connectAudioAnalysis(audio: HTMLAudioElement): void {
    const audioWindow = window as AudioContextWindow;
    const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return;

    disconnectAudioAnalysis(false);
    try {
      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();

      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyser.connect(context.destination);

      audioSourceRef.current = source;
      audioAnalyserRef.current = analyser;
      audioAnalysisDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    } catch {
      disconnectAudioAnalysis(false);
    }
  }

  function stopSimulatedAudio(resetOrb = true): void {
    if (simulationTimerRef.current != null) {
      window.clearTimeout(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    disconnectAudioAnalysis(resetOrb);
    const audio = simulationAudioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      simulationAudioRef.current = null;
    }
  }

  function startSimulation(kind: SimulationKind): void {
    const runId = simulationRunRef.current + 1;
    simulationRunRef.current = runId;
    stopSimulatedAudio();
    const now = performance.now();
    const loadingDurationMs = 3_000;
    const label = kind === 'day' ? 'DAY MUSIC' : 'NIGHT MUSIC';
    let audioHadError = false;

    setSimulationKind(kind);
    setHourOverride(null);
    setBackgroundBusyStartedAt(now);
    setBackgroundBusyUntil(now + loadingDurationMs);
    setSimulatedPlayback({
      kind,
      status: 'loading',
      label,
      startedAt: null,
      durationSec: 30,
    });

    const audio = new Audio(SIMULATION_AUDIO[kind]);
    audio.preload = 'auto';
    audio.volume = 0;
    connectAudioAnalysis(audio);
    simulationAudioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (simulationRunRef.current !== runId) return;
      const durationSec = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
      setSimulatedPlayback((current) => ({ ...current, durationSec }));
    });
    audio.addEventListener('error', () => {
      audioHadError = true;
    });
    audio.addEventListener('ended', () => {
      if (simulationRunRef.current !== runId) return;
      setSimulatedPlayback((current) => ({
        ...current,
        status: 'complete',
        startedAt: null,
      }));
    });

    void audio.play()
      .then(() => {
        if (simulationRunRef.current !== runId) return;
        audio.volume = 0;
      })
      .catch(() => undefined);

    simulationTimerRef.current = window.setTimeout(() => {
      if (simulationRunRef.current !== runId) return;
      simulationTimerRef.current = null;

      if (audioHadError || audio.error) {
        setSimulatedPlayback((current) => ({
          ...current,
          status: 'missing',
          startedAt: null,
        }));
        return;
      }

      audio.volume = 1;
      try {
        audio.currentTime = 0;
      } catch {
        // Some browsers disallow seeking before metadata is ready.
      }

      void audio.play()
        .then(() => {
          if (simulationRunRef.current !== runId) return;
          const durationSec = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
          setSimulatedPlayback({
            kind,
            status: 'playing',
            label,
            startedAt: performance.now(),
            durationSec,
          });
        })
        .catch(() => {
          if (simulationRunRef.current !== runId) return;
          setSimulatedPlayback((current) => ({
            ...current,
            status: 'blocked',
            startedAt: null,
          }));
        });
    }, loadingDurationMs);
  }

  function stopSimulationMusic(): void {
    if (!canStopMusic) return;
    simulationRunRef.current += 1;
    stopSimulatedAudio();
    setBackgroundBusyStartedAt(0);
    setBackgroundBusyUntil(0);
    setSimulatedPlayback((current) => ({
      ...current,
      status: 'idle',
      startedAt: null,
    }));
  }

  async function startLiveData(): Promise<void> {
    if (runtimeRef.current || liveDataStatus === 'starting') return;
    setLiveDataStatus('starting');
    const now = performance.now();
    setBackgroundBusyStartedAt(now);
    setBackgroundBusyUntil(now + 1_800);
    try {
      const motion = new MotionSensor();
      const motionGranted = await motion.requestPermission();
      motion.start();

      const geolocation = new GeolocationSensor();
      geolocation.start();
      let geoGranted = false;
      if ('permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          geoGranted = status.state === 'granted';
        } catch {
          geoGranted = false;
        }
      }
      if (!geoGranted && 'geolocation' in navigator) {
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => reject(new Error('geolocation denied')),
              { enableHighAccuracy: false, timeout: 10_000 },
            );
          });
          geoGranted = true;
        } catch {
          geoGranted = false;
        }
      }

      useStore.getState().setSensors({
        permissionsGranted: { motion: motionGranted, geolocation: geoGranted },
      });
      const aggregator = new StateAggregator(motion, geolocation);
      aggregator.start();
      runtimeRef.current = { aggregator, geolocation, motion };
      setLiveDataStatus('live');
    } catch (error) {
      console.error('[dial] live data failed', error);
      runtimeRef.current?.aggregator.stop();
      runtimeRef.current?.motion.stop();
      runtimeRef.current?.geolocation.stop();
      runtimeRef.current = null;
      setLiveDataStatus('error');
    }
  }

  return (
    <section
      className={`phone-dial ${model.isNight ? 'phone-dial--night' : ''}`}
      aria-label="Hero Syndrome dynamic dial prototype"
      data-composition-package={compositionPackage.version}
      data-live-source={dataSourceLabel}
      data-music-generation={ENABLE_DIAL_MUSIC_GENERATION ? 'enabled' : 'disabled'}
      data-orb-audio={isMusicOrbPlaying ? 'reactive' : 'idle'}
      data-orb-colors={model.orbColors.join(',')}
      data-orb-level={activeMusicOrbLevel.toFixed(3)}
      data-progress-mode={musicProgressMode}
    >
      <svg
        aria-label={`Dial state: ${model.phaseLabel}, ${formatHour(model.hour)}`}
        className={`phone-dial__artboard ${model.isNight ? 'phone-dial__artboard--night' : ''} ${activeOverlay ? 'phone-dial__artboard--selection-open' : ''}`}
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
        <image href={ASSETS.background} filter="url(#backgroundTone)" height="1399" opacity={model.isNight ? '0.22' : '0.86'} preserveAspectRatio="xMidYMid slice" width="1670" x="-660" y="-282" />
        <rect width={FRAME.width} height={FRAME.height} fill={model.isNight ? '#0c1027' : '#90B5D0'} opacity={model.isNight ? '0.62' : '0.45'} />

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
        <circle className="phone-dial__sun-orbit" cx={DIAL_CENTER.x} cy={DIAL_CENTER.y} fill="none" r={SUN_ORBIT_RADIUS} />
        <line className="phone-dial__horizon-line" x1={sunrisePoint.x} x2={sunsetPoint.x} y1={sunrisePoint.y} y2={sunsetPoint.y} />
        <g className="phone-dial__horizon-marker">
          <circle cx={sunrisePoint.x} cy={sunrisePoint.y} r="3" />
          <circle cx={sunsetPoint.x} cy={sunsetPoint.y} r="3" />
          <text x={sunrisePoint.x + 5} y={sunrisePoint.y - 8}>{formatHour(model.sunriseHour).slice(0, 2)}</text>
          <text textAnchor="end" x={sunsetPoint.x - 5} y={sunsetPoint.y - 8}>{formatHour(model.sunsetHour).slice(0, 2)}</text>
        </g>

        <ClockMarks />

        <text className="phone-dial__state-label">
          <textPath href="#stateTextArc" startOffset="50%" textAnchor="middle">
            {model.phaseLabel}
          </textPath>
        </text>

        {model.isNight ? (
          <MoonIndicator x={sunPoint.x} y={sunPoint.y} />
        ) : (
          <SunIndicator x={sunPoint.x} y={sunPoint.y} />
        )}

        <image href={ASSETS.innerRing} height="161" width="160" x={DIAL_CENTER.x - 80} y={DIAL_CENTER.y - 80.5} />
        <image href={ASSETS.innerCore} height="83" width="83" x={DIAL_CENTER.x - 41.5} y={DIAL_CENTER.y - 41.5} />
        <CenterOrb
          activity={selectedActivity}
          bpm={model.bpm}
          colors={model.orbColors}
          intensity={model.raw.stateVector.movement.intensityNormalized}
          isMusicPlaying={isMusicOrbPlaying}
          musicLevel={activeMusicOrbLevel}
          seed={model.bpm + selectedLocation.label.length}
        />
        <OrbBezel />

        <circle
          aria-label="Drag orbit to change time"
          className="phone-dial__orbit-hit-area"
          cx={DIAL_CENTER.x}
          cy={DIAL_CENTER.y}
          fill="transparent"
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          r="189"
        />

        <g
          aria-label={`Place selector: ${selectedLocation.label}`}
          className="phone-dial__arc-button"
          onPointerDown={(event) => openSelection('location', event)}
          role="button"
        >
          <path className="phone-dial__button-arc-fill" d={annularArcPath(BUTTON_INNER_RADIUS, BUTTON_OUTER_RADIUS, 0, BUTTON_ARC_SPAN)} />
          <path className="phone-dial__button-hit-area" d={annularArcPath(BUTTON_INNER_RADIUS - 8, BUTTON_OUTER_RADIUS + 8, 0, BUTTON_ARC_SPAN + 10)} />
          <rect className="phone-dial__button-hit-area" height="36" width="172" x={DIAL_CENTER.x - 86} y={DIAL_CENTER.y - BUTTON_OUTER_RADIUS - 8} />
          <text className="phone-dial__selection-label">
            <textPath href="#topSelectionArc" startOffset="50%" textAnchor="middle">
              {topButtonLabel}
            </textPath>
          </text>
        </g>

        <text className="phone-dial__material-label">
          <textPath href="#topMaterialArc" startOffset="50%" textAnchor="middle">
            {model.materialLabel}
          </textPath>
        </text>
        <text className="phone-dial__material-label phone-dial__material-label--bottom">
          <textPath href="#bottomMaterialArc" startOffset="50%" textAnchor="middle">
            {model.forceLabel}
          </textPath>
        </text>

        <g
          aria-label={`Activity selector: ${selectedActivity.label}`}
          className="phone-dial__arc-button"
          onPointerDown={(event) => openSelection('activity', event)}
          role="button"
        >
          <path className="phone-dial__button-arc-fill" d={annularArcPath(BUTTON_INNER_RADIUS, BUTTON_OUTER_RADIUS, 180, BUTTON_ARC_SPAN)} />
          <path className="phone-dial__button-hit-area" d={annularArcPath(BUTTON_INNER_RADIUS - 8, BUTTON_OUTER_RADIUS + 8, 180, BUTTON_ARC_SPAN + 10)} />
          <rect className="phone-dial__button-hit-area" height="36" width="172" x={DIAL_CENTER.x - 86} y={DIAL_CENTER.y + BUTTON_INNER_RADIUS - 8} />
          <text className="phone-dial__run-label">
            <textPath href="#bottomSelectionArc" startOffset="50%" textAnchor="middle">
              {bottomButtonLabel}
            </textPath>
          </text>
        </g>

        <g className="phone-dial__data-readouts">
          <text x="25" y="710">{dataSourceLabel} / {musicSourceLabel} / {musicProgressLabel}</text>
          <text x="25" y="728">{model.weatherLabel} / {model.tempLabel}</text>
          <text x="25" y="746">{model.motionLabel}</text>
          <text x="25" y="764">{model.placeLabel} / {compositionPackage.music.bpm} BPM / {compositionPackage.music.key}</text>
          <text x="25" y="782">{selectedLocation.label} / {selectedActivity.label}</text>
        </g>
      </svg>
      <div className="phone-dial__live-controls">
        <div className="phone-dial__sim-controls">
          <button
            aria-label="Simulate daytime music"
            className="phone-dial__sim-button phone-dial__sim-button--day"
            disabled={simulatedPlayback.status === 'loading' && simulatedPlayback.kind === 'day'}
            onClick={() => startSimulation('day')}
            type="button"
          >
            DAY MUSIC
          </button>
          <button
            aria-label="Simulate nighttime music"
            className="phone-dial__sim-button phone-dial__sim-button--night"
            disabled={simulatedPlayback.status === 'loading' && simulatedPlayback.kind === 'night'}
            onClick={() => startSimulation('night')}
            type="button"
          >
            NIGHT MUSIC
          </button>
          <button
            aria-label="Stop simulated music"
            className="phone-dial__sim-button phone-dial__sim-button--stop"
            disabled={!canStopMusic}
            onClick={stopSimulationMusic}
            type="button"
          >
            STOP MUSIC
          </button>
        </div>
        <button
          aria-label="Start live device data"
          className="phone-dial__live-button"
          disabled={liveDataStatus === 'starting' || Boolean(liveStateVector)}
          onClick={() => void startLiveData()}
          type="button"
        >
          {liveControlLabel}
        </button>
        <div className="phone-dial__permission-label">{permissionLabel}</div>
      </div>
      <script id="hero-dial-composition-package" type="application/json">
        {JSON.stringify(compositionPackage)}
      </script>
      {activeOverlay ? (
        <SelectionOverlay
          bpm={model.bpm}
          intensity={model.raw.stateVector.movement.intensityNormalized}
          kind={activeOverlay}
          onClose={closeSelectionOverlay}
          onPointerDown={handleSelectionPointerDown}
          onPointerMove={handleSelectionPointerMove}
          onPointerUp={handleSelectionPointerUp}
          options={activeOptions()}
          orbColors={model.orbColors}
          rotation={overlayRotation}
          selectedIndex={activeSelectedIndex()}
        />
      ) : null}
    </section>
  );
}
