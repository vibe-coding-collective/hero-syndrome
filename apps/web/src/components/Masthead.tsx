import { useEffect, useState } from 'react'
import { formatDateline } from '../lib/dateline'

export default function Masthead() {
  const [dateline, setDateline] = useState('')

  useEffect(() => {
    setDateline(formatDateline())
  }, [])

  return (
    <header className="border-b border-ink/15">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-5 flex items-center justify-between gap-6">
        <div className="flex items-baseline gap-3 md:gap-4">
          <span className="font-serif text-[20px] md:text-[24px] font-medium tracking-tightest leading-none">
            Hero Syndrome
          </span>
          <span className="hidden md:inline-block h-3.5 w-px bg-ink/25" />
          <span className="hidden md:inline font-mono text-[10px] small-caps text-ink/55">
            A periodical of soundtracks
          </span>
        </div>
        <div className="font-mono text-[10px] md:text-[11px] small-caps text-ink/55 text-right">
          {dateline || '\u00A0'}
        </div>
      </div>
    </header>
  )
}
