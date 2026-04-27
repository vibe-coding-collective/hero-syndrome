export default function WhatThisIs() {
  return (
    <section className="border-b border-ink/15">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-2">
            <p className="font-mono text-[10px] small-caps text-ink/55 lg:sticky lg:top-8">
              §i &nbsp; What this is
            </p>
          </div>

          <div className="lg:col-span-7">
            <p className="font-serif text-[22px] md:text-[28px] leading-[1.45] text-ink max-w-[40ch]">
              Open the app, tap <em>Begin scene</em>, and a piece of music
              starts. It is composed, in real time, from the small reportage of
              your phone. From the tilt of how you&rsquo;re moving, the weather
              above you, the kind of place you&rsquo;re standing in, the
              hour&rsquo;s slow drift toward dusk, the planet&rsquo;s
              electromagnetic flutter overhead. You drop a mood onto it. It
              listens. It bends. When you stop, what played becomes an{' '}
              <em>episode</em>. Titled, dated, replayable, sendable.
            </p>
          </div>

          <aside className="lg:col-span-3">
            <div className="border border-ink/20 p-5 bg-paper-deep/40">
              <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">
                fig. ii · how it works
              </p>
              <svg viewBox="0 0 200 160" className="w-full h-auto">
                <text
                  x="100"
                  y="22"
                  textAnchor="middle"
                  fontFamily="Fraunces, serif"
                  fontStyle="italic"
                  fontSize="13"
                  fill="#1B1B19"
                >
                  the world
                </text>
                <line
                  x1="100"
                  y1="34"
                  x2="100"
                  y2="60"
                  stroke="#1B1B19"
                  strokeOpacity="0.45"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                />
                <polygon
                  points="100,64 96,58 104,58"
                  fill="#1B1B19"
                  opacity="0.55"
                />
                <text
                  x="100"
                  y="82"
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="10"
                  letterSpacing="2"
                  fill="#1B1B19"
                  opacity="0.7"
                >
                  SIGNALS
                </text>
                <line
                  x1="100"
                  y1="94"
                  x2="100"
                  y2="120"
                  stroke="#1B1B19"
                  strokeOpacity="0.45"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                />
                <polygon
                  points="100,124 96,118 104,118"
                  fill="#1B1B19"
                  opacity="0.55"
                />
                <text
                  x="100"
                  y="142"
                  textAnchor="middle"
                  fontFamily="Fraunces, serif"
                  fontStyle="italic"
                  fontSize="14"
                  fill="#B85A2E"
                >
                  the score
                </text>
              </svg>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
