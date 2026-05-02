import type { SourceContribution } from './types';

// Smithing and metalworking verbs from M. T. Richardson (ed.), Practical
// Blacksmithing (1889), Project Gutenberg.
const WORDS = [
  'annealing', 'beating', 'bending', 'beveling', 'blacking', 'blowing',
  'brazing', 'bronzing', 'burnishing', 'caulking', 'chamfering', 'chasing',
  'chipping', 'clamping', 'cleaning', 'cogging', 'cold-bending', 'cold-shutting',
  'cooling', 'corrugating', 'crowning', 'cutting', 'dishing', 'doubling',
  'dovetailing', 'drawing-down', 'drifting', 'drilling', 'drying', 'easing',
  'edging', 'embossing', 'fettling', 'filing', 'finishing', 'fitting',
  'fluxing', 'forging', 'fullering', 'gauging', 'glazing', 'grinding',
  'hammering', 'hardening', 'heading', 'heating', 'hot-cutting', 'hot-working',
  'jumping', 'lapping', 'leveling', 'levering', 'machining', 'marking',
  'milling', 'necking', 'normalizing', 'notching', 'oiling', 'peening',
  'piercing', 'pinning', 'planishing', 'plating', 'polishing', 'pounding',
  'pressing', 'punching', 'quenching', 'reaming', 'reheating', 'reshaping',
  'riveting', 'rolling', 'sawing', 'scarfing', 'scoring', 'scraping',
  'screwing', 'shaping', 'sharpening', 'shearing', 'shrinking', 'sizing',
  'slitting', 'smelting', 'smithing', 'soldering', 'splitting', 'spreading',
  'stamping', 'stretching', 'striking', 'swaging', 'tempering', 'tending',
  'tightening', 'tonguing', 'truing', 'turning', 'twisting', 'upsetting',
  'welding', 'working',
];

export const blacksmithing: SourceContribution = {
  sourceKey: 'practical-blacksmithing-1889',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'M. T. Richardson (ed.) — Practical Blacksmithing (1889)',
    url: 'https://www.gutenberg.org/ebooks/search/?query=practical+blacksmithing',
    license: 'Public domain',
    method: 'curated-from-domain',
    note: 'Smithing/metalworking verbs from the four-volume practical manual.',
  },
};
