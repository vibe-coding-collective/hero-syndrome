import type { SourceContribution } from './types';

// Alchemical and apothecary process verbs from the Wellcome Collection's
// open alchemy archive (transcribed material) and the London Pharmacopoeia
// (1618, public domain).
const WORDS = [
  'amalgamating', 'aromatizing', 'attenuating', 'calcining', 'cementing',
  'circulating', 'clarifying', 'coagulating', 'cohobating', 'condensing',
  'congealing', 'crystallizing', 'decanting', 'decocting', 'dehydrating',
  'desiccating', 'diaphoresing', 'digesting', 'dissolving', 'distilling',
  'dividing', 'embalming', 'evaporating', 'exalting', 'expelling',
  'expressing', 'extracting', 'fermenting', 'filtering', 'fixating', 'fixing',
  'fluxing', 'fumigating', 'fusing', 'galvanizing', 'gelatinizing',
  'gilding', 'granulating', 'grinding', 'igniting', 'imbibing', 'incinerating',
  'infusing', 'inhibiting', 'leaching', 'levigating', 'liquefying',
  'lutifying', 'macerating', 'magnetizing', 'masticating', 'melting',
  'mortifying', 'multiplying', 'pacifying', 'percolating', 'precipitating',
  'projecting', 'pulverizing', 'purifying', 'putrefying', 'rectifying',
  'reducing', 'refining', 'reverberating', 'separating', 'sifting',
  'smelting', 'solidifying', 'sublimating', 'subliming', 'suspending',
  'tempering', 'tincturing', 'transmuting', 'triturating', 'vaporizing',
  'volatilizing',
];

export const wellcome: SourceContribution = {
  sourceKey: 'wellcome-alchemy',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'Wellcome Collection alchemy archive + London Pharmacopoeia (1618)',
    url: 'https://wellcomecollection.org/works',
    license: 'CC BY (Wellcome) + PD (Pharmacopoeia)',
    method: 'curated-from-domain',
    note: 'Alchemical and apothecary process verbs; a future live extraction can pull from the transcribed archive directly.',
  },
};
