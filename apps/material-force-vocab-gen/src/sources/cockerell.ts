import type { SourceContribution } from './types';

// Bookbinding and printing verbs. Primary source: Joseph Moxon, Mechanick
// Exercises on the Whole Art of Printing (1683–1684) — but the 1683 edition
// is generally only available as un-OCR'd scans. Fallback: Douglas
// Cockerell, Bookbinding and the Care of Books (1901), available in clean
// text from Internet Archive.
const WORDS = [
  'backing', 'bevelling', 'binding', 'blocking', 'blotting', 'boarding',
  'bossing', 'burnishing', 'casing', 'collating', 'covering', 'creasing',
  'crimping', 'cutting', 'edging', 'embossing', 'endpapering', 'finishing',
  'foiling', 'folding', 'foredge-painting', 'gathering', 'gauffering',
  'gilding', 'gluing', 'gold-tooling', 'gouging', 'guarding', 'hammering',
  'headbanding', 'imposing', 'impressing', 'inking', 'jogging', 'joining',
  'lacing', 'lining', 'marbling', 'mitring', 'numbering', 'paginating',
  'paring', 'pasting', 'plating', 'pressing', 'printing', 'punching',
  'recasing', 'restoring', 'ribboning', 'rolling', 'rounding', 'rubricating',
  'scoring', 'sewing', 'shaping', 'sizing', 'slitting', 'smashing',
  'splitting', 'stamping', 'stapling', 'stitching', 'stretching',
  'tipping-in', 'tooling', 'trimming', 'tying', 'typesetting', 'varnishing',
  'wiring',
];

export const cockerell: SourceContribution = {
  sourceKey: 'cockerell-bookbinding-1901',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'Douglas Cockerell — Bookbinding and the Care of Books (1901)',
    url: 'https://archive.org/details/bookbindingcareo00cock',
    license: 'Public domain',
    method: 'curated-from-domain',
    note: 'Bookbinding/printing vocabulary. Stands in for Joseph Moxon, Mechanick Exercises on the Whole Art of Printing (1683–1684), whose pre-OCR scans were not machine-readable as of sourcing.',
  },
};
