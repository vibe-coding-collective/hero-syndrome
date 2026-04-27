import type { TraceVariant } from '../data/episodes'

type Props = {
  variant: TraceVariant
  className?: string
  showAxis?: boolean
  stickerColor?: string
}

const PATHS: Record<TraceVariant, string> = {
  walking:
    'M0,62 Q15,55 25,58 T50,52 T75,60 T100,50 T125,58 T150,48 T175,56 T200,46 T225,54 T250,46 T275,52 T300,50',
  still:
    'M0,55 Q40,52 80,55 T160,55 T240,53 T300,55',
  rain: 'M0,38 L60,40 L80,38 L100,42 L118,38 L130,80 Q145,82 158,76 T188,82 T220,75 T250,82 T280,78 L300,82',
  transit:
    'M0,75 L24,72 L40,38 Q60,30 90,32 L240,30 Q260,32 270,38 L290,68 L300,72',
  dusk:
    'M0,28 Q40,32 80,40 T160,55 T240,72 T300,82',
  gold:
    'M0,72 Q40,68 80,60 T160,46 T240,38 T300,32',
}

const STICKERS: Record<TraceVariant, Array<{ x: number; y: number }>> = {
  walking: [{ x: 90, y: 56 }, { x: 210, y: 50 }],
  still: [{ x: 120, y: 55 }, { x: 200, y: 54 }],
  rain: [{ x: 130, y: 80 }, { x: 220, y: 75 }, { x: 270, y: 80 }],
  transit: [{ x: 150, y: 31 }],
  dusk: [{ x: 110, y: 48 }],
  gold: [{ x: 80, y: 60 }, { x: 230, y: 39 }],
}

export default function SignalTrace({
  variant,
  className = '',
  showAxis = false,
  stickerColor = '#B85A2E',
}: Props) {
  const path = PATHS[variant]
  const stickers = STICKERS[variant]
  return (
    <svg
      viewBox="0 0 300 100"
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Signal trace: ${variant}`}
    >
      {showAxis && (
        <line
          x1="0"
          y1="99"
          x2="300"
          y2="99"
          stroke="#1B1B19"
          strokeOpacity="0.18"
          strokeWidth="0.5"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="#1B1B19"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {stickers.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r="2.4"
          fill={stickerColor}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}
