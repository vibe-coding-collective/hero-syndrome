import SignalTrace from './SignalTrace'

export default function SendOne() {
  return (
    <section className="border-b border-ink/15 bg-paper-deep/40">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">
              §v · A dispatch
            </p>
            <h2 className="font-serif text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink">
              Make one. <span className="italic text-rust">Send it.</span>
            </h2>
            <p className="mt-6 font-serif text-[18px] md:text-[20px] leading-[1.55] text-ink/85 max-w-[40ch]">
              Every session ends as an episode at its own quiet URL. Send it to
              one friend. Send it to your future self. Or close the tab and let
              it sit in someone else&rsquo;s archive, unread, like a postcard
              that took the long way home.
            </p>
            <button
              type="button"
              className="group mt-10 inline-flex items-baseline gap-3 px-7 py-4 border border-ink text-ink font-serif text-[18px] md:text-[20px] hover:bg-ink hover:text-paper transition-colors duration-300"
            >
              Begin a scene
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </button>
          </div>

          <div className="lg:col-span-7">
            <Postcard />
          </div>
        </div>
      </div>
    </section>
  )
}

function Postcard() {
  return (
    <div className="relative rotate-[-1.2deg] hover:rotate-0 transition-transform duration-500">
      <div className="absolute -inset-3 bg-ink/5 blur-md rounded-md -z-10" />
      <div className="bg-paper border border-ink/25 shadow-[0_2px_0_0_rgba(27,27,25,0.05),0_18px_40px_-22px_rgba(27,27,25,0.35)]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="aspect-[5/4] md:aspect-auto border-b md:border-b-0 md:border-r border-ink/20 relative">
            <SignalTrace
              variant="walking"
              className="absolute inset-0 w-full h-full px-6 py-8"
            />
            <div className="absolute top-4 left-5 font-mono text-[9px] small-caps text-ink/55">
              greetings from
            </div>
            <div className="absolute bottom-4 left-5 font-serif italic text-[15px] text-ink/75">
              your Tuesday
            </div>
          </div>

          <div className="p-6 md:p-7 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="font-mono text-[9px] small-caps text-ink/55 leading-[1.6]">
                Hero Syndrome
                <br />
                Episode service
              </div>
              <Stamp />
            </div>

            <div className="space-y-4 mb-6">
              <Field label="from" value="you, today" />
              <Field label="to" value="you, in two weeks" />
            </div>

            <div className="flex-1 border-t border-ink/15 pt-4">
              <p className="font-serif italic text-[15px] md:text-[16px] leading-[1.5] text-ink/80">
                a walk home, longer than it needed to be. listen on the next
                cloudy afternoon, ideally near a window.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-ink/15 flex items-center justify-between">
              <div className="font-mono text-[9px] small-caps text-ink/55">
                Postmarked · today
              </div>
              <div className="font-mono text-[9px] small-caps text-rust">
                Issue №14 · 24 min
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] small-caps text-ink/45 mb-1">
        {label}
      </div>
      <div className="font-serif text-[18px] text-ink border-b border-dashed border-ink/30 pb-1">
        {value}
      </div>
    </div>
  )
}

function Stamp() {
  return (
    <div className="shrink-0 w-16 h-20 border border-ink/40 p-1.5 relative bg-paper-deep/50">
      <div className="border border-ink/35 w-full h-full grid place-items-center">
        <div className="text-center leading-none">
          <div className="font-serif text-[18px] text-rust">HS</div>
          <div className="font-mono text-[7px] small-caps text-ink/55 mt-1">
            ongoing
            <br />
            life
          </div>
        </div>
      </div>
      <div className="absolute -top-0.5 left-0 right-0 h-1 bg-paper [mask-image:radial-gradient(circle_2px_at_4px_2px,transparent_99%,black_100%)] [mask-size:8px_4px] [mask-repeat:repeat-x]" />
    </div>
  )
}
