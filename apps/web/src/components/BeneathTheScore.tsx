type Panel = {
  num: string
  fig: string
  number: string
  heading: string
  body: string
  annotation: string
}

const PANELS: Panel[] = [
  {
    num: 'i',
    fig: 'fig. vi',
    number: '16',
    heading: 'Sixteen bytes, per song.',
    body: 'Each time a new piece is composed, sixteen fresh quantum bytes are pulled from a reservoir of vacuum fluctuations measured at the Australian National University. Five drive the phrase of the moment; the rest are held against the small choices the composition has to make. BPM inside a range. Key when several would work. Which instrument leads. The bytes are not part of the song. They are the ground beneath it.',
    annotation:
      'fig. vi · ANU QRNG → reservoir → composition. 16 bytes per call.',
  },
  {
    num: 'ii',
    fig: 'fig. vii',
    number: '1',
    heading: 'One cosmic word, per song.',
    body: 'Before each new piece, the latest thirteen-channel proton flux from NOAA’s GOES satellites is fetched. The vector is projected through a fixed random matrix into a 384-dimensional embedding space. The nearest neighbor in today’s vocabulary becomes the song’s cosmic word. The word is causally produced by particle radiation. The projection has no learned semantic structure. Provenance, not perception.',
    annotation:
      'fig. vii · GOES flux × random projection → nearest neighbor in today’s vocab. 13 channels in, 1 word out.',
  },
  {
    num: 'iii',
    fig: 'fig. viii',
    number: '256',
    heading: 'A daily vocabulary, by quantum.',
    body: 'At 0:00 UTC, five hundred and twelve fresh ANU bytes redraw the cosmic-word vocabulary. Two hundred fifty-six words are sampled from a stable approved pool of about two thousand, drawn from the EFF Long Word List and filtered by Claude Haiku for evocativeness. Same flux on a different day produces a different word. Replays of old episodes keep their original word, recorded against the vocabulary date.',
    annotation:
      'fig. viii · redrawn at 0:00 UTC daily. 512 quantum bytes, 256 words, one signed seed.',
  },
  {
    num: 'iv',
    fig: 'fig. ix',
    number: '2',
    heading: 'A phrase of the moment, per song.',
    body: 'Beneath each song, a small phrase: a material and a force, in either order. Open texts contribute the words — Mrs Beeton’s ‘Book of Household Management,’ Hakluyt’s ‘Principal Navigations,’ the USGS Glossary of Geologic Terms, and other long-out-of-copyright registers. Current space weather — K-index, solar wind speed, solar wind density — is projected into a shared embedding space; the phrase is sampled from the pool by similarity, with the song’s quantum bytes as the random source. Different lenses on the same particle weather.',
    annotation:
      'fig. ix · k, wind speed, density → similarity-weighted sample. Two words out.',
  },
]

export default function BeneathTheScore() {
  return (
    <section className="border-b border-ink/15">
      <div className="mx-auto max-w-7xl px-6 md:px-12 py-20 md:py-28">
        <div className="flex items-baseline justify-between gap-6 mb-14 md:mb-20">
          <p className="font-mono text-[10px] small-caps text-ink/55">
            §iii · Beneath the score
          </p>
          <p className="hidden md:block font-serif italic text-[15px] text-ink/55">
            four layers of provenance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-10">
          {PANELS.map((p) => (
            <article key={p.num} className="flex flex-col">
              <div className="border border-ink/18 bg-paper-deep/40 p-6 mb-6 grid place-items-center min-h-[140px]">
                <div className="font-serif font-light text-[88px] leading-[0.9] text-rust tracking-tightest">
                  {p.number}
                </div>
              </div>
              <p className="font-mono text-[10px] small-caps text-ink/55 mb-3">
                Layer {p.num}
              </p>
              <h3 className="font-serif text-[24px] md:text-[26px] leading-[1.12] tracking-tight text-ink mb-4">
                {p.heading}
              </h3>
              <p className="font-serif text-[15px] md:text-[16px] leading-[1.55] text-ink/85 max-w-[36ch]">
                {p.body}
              </p>
              <p className="mt-4 font-serif italic text-[12.5px] text-ink/55 leading-[1.5]">
                {p.annotation}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
