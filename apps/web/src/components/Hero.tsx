export default function Hero() {
  return (
    <section className="border-b border-ink/15">
      <div className="mx-auto max-w-7xl px-6 md:px-12 pt-20 md:pt-32 pb-20 md:pb-28">
        <p className="font-mono text-[11px] small-caps text-ink/55 mb-10 md:mb-14">
          Issue №14 · Cover Story
        </p>

        <h1 className="display font-serif font-light text-[48px] leading-[1.02] sm:text-[72px] md:text-[104px] lg:text-[128px] tracking-tightest text-ink max-w-[14ch]">
          Music for ongoing life.
        </h1>

        <div className="mt-12 md:mt-16 max-w-2xl">
          <p className="font-serif italic text-[19px] md:text-[22px] leading-[1.5] text-ink/85">
            An adaptive score, generated live from your phone&rsquo;s signals.
            Time, weather, motion, place, Earth&rsquo;s electromagnetic mood,
            and the moods you drop on it. A session becomes an episode you
            can replay or send.
          </p>
        </div>

        <div className="mt-12 md:mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-4">
          <button
            type="button"
            className="group inline-flex items-baseline gap-3 px-7 py-4 border border-rust text-rust font-serif text-[20px] md:text-[22px] hover:bg-rust hover:text-paper transition-colors duration-300"
          >
            Begin scene
            <span
              aria-hidden
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </button>
          <a
            href="#archive"
            className="font-mono text-[11px] small-caps text-ink/65 hover:text-ink underline-offset-4 decoration-ink/30 hover:decoration-ink"
          >
            Or open the archive
          </a>
        </div>
      </div>
    </section>
  )
}
