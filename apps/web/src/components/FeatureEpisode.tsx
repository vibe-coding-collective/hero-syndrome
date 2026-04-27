import { featured } from '../data/episodes'
import SignalTrace from './SignalTrace'
import PlayButton from './PlayButton'

export default function FeatureEpisode() {
  const ep = featured
  return (
    <section className="border-b border-ink/15 bg-paper-deep/50">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <div className="lg:col-span-7">
            <div className="aspect-[16/10] bg-paper border border-ink/15 relative overflow-hidden">
              <SignalTrace
                variant={ep.trace}
                className="absolute inset-0 w-full h-full px-6 md:px-10 py-10 md:py-14"
              />
              <div className="absolute top-4 left-5 font-mono text-[10px] small-caps text-ink/55">
                fig. 1 · accelerometer + weather, 4h 12m
              </div>
              <div className="absolute top-4 right-5 font-mono text-[10px] small-caps text-ink/55">
                K 4 · ~96 bytes
              </div>
              <div className="absolute bottom-4 right-5 font-mono text-[10px] small-caps text-ink/55">
                18.42 to 22.54
              </div>
              <div className="absolute bottom-4 left-5 font-mono text-[10px] small-caps text-ink/55">
                vocab of apr 24
              </div>
            </div>
            <p className="mt-4 font-serif italic text-[14px] md:text-[15px] text-ink/65 max-w-xl">
              {ep.annotation}
            </p>
          </div>

          <div className="lg:col-span-5">
            <p className="font-mono text-[10px] small-caps text-ink/55">
              Issue №{ep.number} · Cover Story
            </p>
            <h2 className="mt-5 display font-serif font-light text-[34px] md:text-[44px] leading-[1.08] tracking-tight text-ink">
              {ep.title}
            </h2>
            <p className="mt-6 font-mono text-[11px] small-caps text-ink/65">
              by {ep.byline}
              <span className="mx-2 text-ink/35">·</span>
              {ep.dateline}
              <span className="mx-2 text-ink/35">·</span>
              {ep.runtimeMin} min
            </p>

            {ep.cosmicWord && (
              <p className="mt-3 font-serif italic text-[14px] text-ink/60">
                Drawn under{' '}
                <span className="text-rust not-italic font-medium">
                  {ep.cosmicWord}
                </span>
                , by GOES particle flux.
              </p>
            )}

            <div className="mt-10 flex items-center gap-5">
              <PlayButton size="lg" label={`Play ${ep.title}`} />
              <div className="font-mono text-[11px] small-caps text-ink/55 leading-[1.6]">
                Listen to the cover
                <br />
                <span className="text-ink/40">~ 24 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
