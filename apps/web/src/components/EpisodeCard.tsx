import type { EpisodeSeed } from '../data/episodes'
import SignalTrace from './SignalTrace'
import PlayButton from './PlayButton'

export default function EpisodeCard({ ep }: { ep: EpisodeSeed }) {
  return (
    <article className="group flex flex-col bg-paper border border-ink/15 hover:border-ink/35 transition-colors duration-300">
      <div className="aspect-[4/3] border-b border-ink/15 relative overflow-hidden bg-paper-deep/30">
        <SignalTrace
          variant={ep.trace}
          className="absolute inset-0 w-full h-full px-5 py-6"
        />
        <div className="absolute top-3 left-4 font-mono text-[9px] small-caps text-ink/55">
          fig. {ep.number}
        </div>
        <div className="absolute top-3 right-4 font-mono text-[9px] small-caps text-ink/55">
          №{ep.number}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 md:p-6 flex-1">
        <h3 className="font-serif text-[22px] md:text-[24px] leading-[1.15] tracking-tight text-ink">
          {ep.title}
        </h3>
        <p className="font-mono text-[10px] small-caps text-ink/55 leading-[1.7]">
          by {ep.byline}
          <br />
          {ep.dateline}
          <span className="mx-2 text-ink/30">·</span>
          {ep.runtimeMin} min
        </p>
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-ink/12">
          <p className="font-serif italic text-[12.5px] text-ink/55 leading-snug pr-3 max-w-[28ch]">
            {ep.annotation}
          </p>
          <PlayButton size="sm" label={`Play ${ep.title}`} />
        </div>
      </div>
    </article>
  )
}
