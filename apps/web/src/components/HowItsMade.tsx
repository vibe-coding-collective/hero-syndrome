type Panel = {
  num: string
  heading: string
  body: string
  annotation: string
  diagram: 'world' | 'signals' | 'score'
}

const PANELS: Panel[] = [
  {
    num: 'i',
    heading: 'A scene begins.',
    body: 'You step outside, or you don\u2019t. A bus pulls away. The afternoon tilts toward gold. The phone, in your pocket or your hand, is paying close attention.',
    annotation:
      'fig. iii · accelerometer at ~10 Hz, geolocation low-accuracy, weather refreshed every 10 min.',
    diagram: 'world',
  },
  {
    num: 'ii',
    heading: 'The world is read.',
    body: 'Time, weather, motion, the kind of place around you, and any moods you\u2019ve dropped on the score are gathered every few seconds into a small portrait of right now.',
    annotation:
      'fig. iv · state vector, sampled at 5s. Earth’s K-index frozen at session start.',
    diagram: 'signals',
  },
  {
    num: 'iii',
    heading: 'A score is written.',
    body: 'A music director reads the portrait, picks what should come next, and an instrument generates a complete piece. The next piece reads the previous one. The score is continuous.',
    annotation:
      'fig. v · composition plan, 3 to 6 minutes, 1 to 30 sections. 16 quantum bytes seed each.',
    diagram: 'score',
  },
]

function Diagram({ kind }: { kind: Panel['diagram'] }) {
  if (kind === 'world') {
    return (
      <svg viewBox="0 0 220 100" className="w-full h-auto">
        <line
          x1="0"
          y1="78"
          x2="220"
          y2="78"
          stroke="#1B1B19"
          strokeOpacity="0.25"
          strokeWidth="0.8"
        />
        <path
          d="M0,72 Q40,68 60,70 T120,55 L140,55 L150,40 L160,55 L200,52 L220,58"
          fill="none"
          stroke="#1B1B19"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <circle cx="44" cy="22" r="9" fill="none" stroke="#B85A2E" strokeWidth="1" />
        <text
          x="110"
          y="96"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          letterSpacing="1.5"
          fill="#1B1B19"
          opacity="0.55"
        >
          HORIZON · 14.22
        </text>
      </svg>
    )
  }
  if (kind === 'signals') {
    return (
      <svg viewBox="0 0 220 100" className="w-full h-auto">
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            y1={20 + i * 18}
            x2="220"
            y2={20 + i * 18}
            stroke="#1B1B19"
            strokeOpacity="0.18"
            strokeWidth="0.5"
            strokeDasharray="1 3"
          />
        ))}
        <path
          d="M0,30 L40,28 L80,32 L120,22 L160,30 L220,26"
          stroke="#1B1B19"
          strokeWidth="1.1"
          fill="none"
        />
        <path
          d="M0,52 Q30,48 60,52 T120,50 T220,48"
          stroke="#1B1B19"
          strokeWidth="1.1"
          fill="none"
        />
        <path
          d="M0,68 L30,64 L60,66 L90,62 L120,72 L150,66 L220,68"
          stroke="#1B1B19"
          strokeWidth="1.1"
          fill="none"
        />
        <path
          d="M0,86 L40,82 L80,86 L120,80 L160,84 L220,82"
          stroke="#B85A2E"
          strokeWidth="1.2"
          fill="none"
        />
        <text
          x="226"
          y="32"
          fontFamily="JetBrains Mono, monospace"
          fontSize="8"
          fill="#1B1B19"
          opacity="0.55"
        >
          time
        </text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 220 100" className="w-full h-auto">
      {[10, 30, 50, 70, 90].map((y) => (
        <line
          key={y}
          x1="10"
          y1={y}
          x2="210"
          y2={y}
          stroke="#1B1B19"
          strokeOpacity="0.18"
          strokeWidth="0.5"
        />
      ))}
      {[
        { x: 30, y: 30, h: 30 },
        { x: 60, y: 50, h: 12 },
        { x: 90, y: 22, h: 38 },
        { x: 120, y: 38, h: 22 },
        { x: 150, y: 30, h: 30 },
        { x: 180, y: 46, h: 18 },
      ].map((n, i) => (
        <g key={i}>
          <line
            x1={n.x}
            y1={n.y}
            x2={n.x}
            y2={n.y + n.h}
            stroke="#1B1B19"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <circle cx={n.x} cy={n.y} r="1.8" fill="#B85A2E" />
        </g>
      ))}
      <text
        x="110"
        y="98"
        textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
        fontSize="9"
        letterSpacing="1.5"
        fill="#1B1B19"
        opacity="0.55"
      >
        SECTIONS · ~5 MIN
      </text>
    </svg>
  )
}

export default function HowItsMade() {
  return (
    <section className="border-b border-ink/15 bg-paper-deep/40">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="flex items-baseline justify-between gap-6 mb-14 md:mb-20">
          <p className="font-mono text-[10px] small-caps text-ink/55">
            §ii · How an episode is made
          </p>
          <p className="hidden md:block font-serif italic text-[15px] text-ink/55">
            in three movements
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10">
          {PANELS.map((p) => (
            <article key={p.num} className="flex flex-col">
              <div className="border border-ink/18 bg-paper p-5 mb-6">
                <Diagram kind={p.diagram} />
              </div>
              <p className="font-mono text-[10px] small-caps text-ink/55 mb-3">
                Movement {p.num}
              </p>
              <h3 className="font-serif text-[28px] md:text-[32px] leading-[1.1] tracking-tight text-ink mb-4">
                {p.heading}
              </h3>
              <p className="font-serif text-[16px] md:text-[17px] leading-[1.55] text-ink/85 max-w-[34ch]">
                {p.body}
              </p>
              <p className="mt-4 font-serif italic text-[13px] text-ink/55">
                {p.annotation}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
