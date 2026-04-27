import { archive } from '../data/episodes'
import EpisodeCard from './EpisodeCard'

export default function Archive() {
  return (
    <section id="archive" className="border-b border-ink/15">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="flex items-end justify-between gap-6 mb-12 md:mb-16">
          <div>
            <p className="font-mono text-[10px] small-caps text-ink/55 mb-3">
              §iv · From the archive
            </p>
            <h2 className="font-serif text-[36px] md:text-[52px] leading-[1.05] tracking-tight text-ink">
              Recently sent.
            </h2>
          </div>
          <a
            href="#"
            className="hidden md:inline font-mono text-[11px] small-caps text-ink/65 hover:text-ink underline-offset-4 decoration-ink/30 hover:decoration-ink"
          >
            All issues →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {archive.map((ep) => (
            <EpisodeCard key={ep.id} ep={ep} />
          ))}
        </div>
      </div>
    </section>
  )
}
