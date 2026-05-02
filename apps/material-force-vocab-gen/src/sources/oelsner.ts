import type { SourceContribution } from './types';

// Weaving and textile-manufacturing verbs from G. H. Oelsner's A Handbook
// of Weaves (1915), Internet Archive.
const WORDS = [
  'beating', 'binding', 'bleaching', 'bobbining', 'calendering', 'carding',
  'combing', 'crossing', 'damping', 'doubling', 'drawing-in', 'drawing-off',
  'dressing', 'drying', 'dyeing', 'fagoting', 'fulling', 'gauging',
  'glazing', 'hackling', 'heddling', 'lacing', 'lashing', 'lifting',
  'looming', 'looping', 'lopping', 'lumping', 'mercerizing', 'milling',
  'napping', 'packing', 'picking', 'piecing', 'plying', 'pressing',
  'raddling', 'reeding', 'reeling', 'retting', 'roving', 'scutching',
  'selvedging', 'setting', 'shedding', 'shooting', 'shuttling', 'sizing',
  'slubbing', 'spinning', 'spooling', 'stretching', 'stripping', 'tasseling',
  'tentering', 'threading', 'throwing', 'treadling', 'twining', 'twisting',
  'unwinding', 'wadding', 'warping', 'weighting', 'weaving', 'winding',
  'working', 'yarning',
];

export const oelsner: SourceContribution = {
  sourceKey: 'oelsner-weaves-1915',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'G. H. Oelsner — A Handbook of Weaves (1915)',
    url: 'https://archive.org/details/handbookofweaves00oels',
    license: 'Public domain',
    method: 'curated-from-domain',
    note: 'Weaving / textile manufacturing verbs; chapters in the original name each weave structure.',
  },
};
