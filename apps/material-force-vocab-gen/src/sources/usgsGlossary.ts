import type { SourceContribution } from './types';

// Geological process verbs from the USGS Glossary of Geologic Terms.
const WORDS = [
  'aggrading', 'alluviating', 'avalanching', 'brecciating', 'cementing',
  'compacting', 'consolidating', 'corroding', 'crystallizing', 'denuding',
  'depositing', 'diking', 'dissolving', 'downwarping', 'drifting', 'eroding',
  'evaporating', 'extruding', 'faulting', 'fissuring', 'flooding', 'flowing',
  'folding', 'fracturing', 'freezing-thawing', 'frosting', 'glaciating',
  'grinding', 'incising', 'intruding', 'jointing', 'lithifying', 'melting',
  'metamorphosing', 'mineralizing', 'outwashing', 'overflowing', 'oxidizing',
  'percolating', 'pulverizing', 'recrystallizing', 'reworking', 'sapping',
  'scarring', 'sedimenting', 'shearing', 'silting', 'sintering', 'slumping',
  'smoothing', 'solidifying', 'sorting', 'splintering', 'stratifying',
  'subducting', 'subsiding', 'terracing', 'transgressing', 'undercutting',
  'undermining', 'uplifting', 'venting', 'washing-out', 'waterlogging',
  'weathering', 'wedging',
];

export const usgsGlossary: SourceContribution = {
  sourceKey: 'usgs-glossary-geologic-terms',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'USGS Glossary of Geologic Terms',
    url: 'https://www.usgs.gov/glossaries',
    license: 'Public domain (US government work)',
    method: 'curated-from-domain',
    note: 'Geological process verbs.',
  },
};
