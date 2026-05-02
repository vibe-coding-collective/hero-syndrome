type Footnote = { n: number; html: string };

// Kept in sync with docs/data-sources.md. Numbering is stable so external
// references (e.g. ¹, ², ³ in body copy elsewhere) stay valid.
const FOOTNOTES: Footnote[] = [
  { n: 1, html: 'NOAA Space Weather Prediction Center — solar wind plasma, planetary K-index, GOES proton flux. Public domain (US government).' },
  { n: 2, html: 'Australian National University Quantum Random Number Generator — true random bytes from quantum vacuum fluctuations.' },
  { n: 3, html: 'RRUFF Project IMA Mineral List — in partnership with the International Mineralogical Association.' },
  { n: 4, html: 'The Color of Art Pigment Database — organised by Color Index pigment codes.' },
  { n: 5, html: 'Cooper Hewitt Smithsonian Design Museum textile thesaurus, with the 1909 <em>Encyclopedia of Textiles</em> (H. W. Schofield) on Project Gutenberg.' },
  { n: 6, html: 'Project Gutenberg historical texts — Hakluyt’s <em>Principal Navigations</em>, Marco Polo’s <em>Travels</em>, Mandeville’s <em>Travels</em>.' },
  { n: 7, html: 'USGS Geographic Names Information System — generic landform terms. From the US Geological Survey, public domain.' },
  { n: 8, html: 'Mrs Isabella Beeton, <em>The Book of Household Management</em> (1861) — Project Gutenberg.' },
  { n: 9, html: 'M. T. Richardson (ed.), <em>Practical Blacksmithing</em> (1889) — Project Gutenberg.' },
  { n: 10, html: 'Wellcome Collection alchemy archive (transcribed materials).' },
  { n: 11, html: 'G. H. Oelsner, <em>A Handbook of Weaves</em> (1915) — Internet Archive.' },
  { n: 12, html: 'Douglas Cockerell, <em>Bookbinding and the Care of Books</em> (1901) — Internet Archive. Stands in for Joseph Moxon, <em>Mechanick Exercises on the Whole Art of Printing</em> (1683–1684).' },
  { n: 13, html: 'USGS Glossary of Geologic Terms — US Geological Survey, public domain.' },
  { n: 14, html: 'bge-small-en-v1.5 embeddings via Cloudflare Workers AI (MIT license).' },
  { n: 15, html: 'Full attribution and methodology in <code>docs/data-sources.md</code> in the repository.' },
];

export default function SourcesFootnotes({
  variant = 'block',
}: {
  variant?: 'block' | 'compact';
}) {
  return (
    <section className={variant === 'block' ? 'mt-16 border-t border-ink/15 pt-10' : ''}>
      <p className="font-mono text-[10px] small-caps text-ink/55 mb-4">Sources</p>
      <p className="font-serif italic text-[14px] md:text-[15px] leading-[1.65] text-ink/75 max-w-[64ch]">
        Each scene, the latest NOAA space weather<sup>1</sup> — solar wind speed, density, and the
        planetary K-index — is projected into a shared embedding space, then sampled with the song’s
        own quantum bytes<sup>2</sup>. The sample picks one word from a pool of materials<sup>3,4,5,6,7</sup> and
        one from a pool of forces<sup>8,9,10,11,12,13</sup>, drawn from open texts and curated lists.
        Different lenses on the same particle weather.
      </p>
      <ol className="mt-6 space-y-1 font-mono text-[10.5px] leading-[1.6] text-ink/60">
        {FOOTNOTES.map((f) => (
          <li key={f.n} className="flex gap-2">
            <span className="text-ink/45 tabular-nums">{f.n}.</span>
            <span dangerouslySetInnerHTML={{ __html: f.html }} />
          </li>
        ))}
      </ol>
    </section>
  );
}
