export default function Colophon() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          <div className="lg:col-span-5">
            <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">
              Colophon
            </p>
            <h2 className="font-serif text-[36px] md:text-[44px] leading-[1.1] tracking-tight text-ink">
              On what this is, and isn&rsquo;t.
            </h2>
            <p className="mt-6 font-serif italic text-[16px] leading-[1.6] text-ink/65 max-w-[36ch]">
              A small periodical for people who suspect their afternoons might
              count. Made on iOS, lives on the open web.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-10">
            <div>
              <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">
                Hero Syndrome is
              </p>
              <ul className="font-serif text-[15px] leading-[1.7] text-ink/85 space-y-1.5">
                <li>An adaptive score, generated live.</li>
                <li>A sequence of full songs, played back to back.</li>
                <li>Drawn from quantum vacuum, by commitment.</li>
                <li>Stamped with a cosmic word, by particle flux.</li>
                <li>A single shareable URL per episode.</li>
                <li>iOS-first, browser-everywhere.</li>
                <li>Free to listen, while it is.</li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">
                Hero Syndrome is not
              </p>
              <ul className="font-serif italic text-[15px] leading-[1.7] text-ink/65 space-y-1.5">
                <li>A music generator you prompt.</li>
                <li>A DAW, a fitness app, a wellness app.</li>
                <li>An always-on ambient layer.</li>
                <li>A platform, a network, a feed.</li>
                <li>Tracking you. There is no account.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 pt-8 border-t border-ink/15 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="font-mono text-[10px] small-caps text-ink/55 leading-[1.7]">
            Set in Fraunces &amp; JetBrains Mono.
            <br />
            Audio by ElevenLabs Music. Direction by Claude Haiku.
            <br />
            Quantum bytes from ANU. Pseudo fallback named on the page.
            <br />
            Cosmic word from GOES proton flux, projected into the day&rsquo;s vocabulary, redrawn at midnight UTC.
            <br />
            No newsletter, no analytics, no cookies.
          </div>
          <div className="font-mono text-[10px] small-caps text-ink/40 leading-[1.7] md:text-right">
            Hero Syndrome
            <br />
            An ongoing periodical
            <br />
            MMXXVI · ∞
          </div>
        </div>
      </div>
    </footer>
  )
}
