import type { SourceContribution } from './types';

// Cooking and household-craft gerunds from Mrs Isabella Beeton's Book of
// Household Management (1861), Project Gutenberg ID 10136.
const WORDS = [
  'baking', 'basting', 'beating', 'blanching', 'blending', 'blooming',
  'boiling', 'braising', 'brewing', 'broiling', 'browning', 'bruising',
  'butchering', 'candying', 'caramelizing', 'carving', 'chilling', 'chopping',
  'churning', 'clarifying', 'coddling', 'creaming', 'crimping', 'crumbling',
  'crushing', 'cutting', 'decanting', 'deglazing', 'dredging', 'dressing',
  'drying', 'dusting', 'emulsifying', 'fermenting', 'filleting', 'flouring',
  'folding', 'forcing', 'frothing', 'frying', 'garnishing', 'glazing',
  'grating', 'griddling', 'grilling', 'grinding', 'icing', 'infusing',
  'jellying', 'kneading', 'larding', 'leavening', 'macerating', 'mashing',
  'measuring', 'mincing', 'mulling', 'paring', 'parboiling', 'parching',
  'pickling', 'piping', 'plating', 'plucking', 'plunging', 'poaching',
  'pounding', 'pressing', 'proofing', 'pureeing', 'quartering', 'reducing',
  'rendering', 'ripening', 'roasting', 'rolling', 'rubbing', 'salting',
  'sautéing', 'scalding', 'scoring', 'searing', 'seasoning', 'serving',
  'shelling', 'sifting', 'simmering', 'singeing', 'skimming', 'slicing',
  'smoking', 'soaking', 'sousing', 'spitting', 'spooning', 'sprinkling',
  'steaming', 'steeping', 'stewing', 'stirring', 'straining', 'stripping',
  'stuffing', 'sweating', 'sweetening', 'tempering', 'thickening', 'thinning',
  'tossing', 'trimming', 'trussing', 'turning', 'twisting', 'whipping',
  'whisking', 'wilting', 'winnowing', 'zesting',
];

export const beeton: SourceContribution = {
  sourceKey: 'beeton-1861',
  pool: 'force',
  words: WORDS,
  meta: {
    title: 'Mrs Isabella Beeton — The Book of Household Management (1861)',
    url: 'https://www.gutenberg.org/ebooks/10136',
    license: 'Public domain',
    method: 'curated-from-domain',
    note: 'Cooking and household-craft gerunds. Live extraction from the full Gutenberg text would yield more.',
  },
};
