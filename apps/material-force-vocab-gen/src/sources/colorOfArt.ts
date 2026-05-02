import type { SourceContribution } from './types';

// Representative seed list of historical and modern artists' pigment names
// drawn from The Color of Art Pigment Database (organized by Color Index
// pigment codes). Single-word pigment names only; compound names elided.
const WORDS = [
  'alizarin', 'asphaltum', 'auripigment', 'azurite', 'bistre', 'bole',
  'caput-mortuum', 'carmine', 'cerulean', 'chrome-orange', 'chrome-yellow',
  'cinnabar', 'cobalt-blue', 'cobalt-violet', 'cochineal', 'cremnitz-white',
  'damar', 'dioxazine', 'dragon-blood', 'egg-tempera', 'egyptian-blue',
  'flake-white', 'gamboge', 'gesso', 'gilders-clay', 'glauconite',
  'green-earth', 'hansa-yellow', 'hematite', 'imperial-purple',
  'indian-yellow', 'indigo', 'ivory-black', 'kremnitz', 'lac', 'lampblack',
  'lapis-lazuli', 'lead-tin-yellow', 'lead-white', 'logwood', 'madder',
  'malachite', 'maroon', 'massicot', 'mauveine', 'minium', 'mosaic-gold',
  'mummy', 'naples-yellow', 'ochre', 'orpiment', 'oxgall', 'paris-green',
  'phthalo-blue', 'phthalo-green', 'prussian-blue', 'pumice', 'quinacridone',
  'raw-sienna', 'raw-umber', 'realgar', 'sap-green', 'scheele-green', 'sepia',
  'sienna', 'silver-leaf', 'sinopia', 'smalt', 'soot-black', 'stil-de-grain',
  'taupe', 'terre-verte', 'titanium-white', 'turbith', 'tyrian-purple',
  'ultramarine', 'umber', 'vandyke-brown', 'vermilion', 'verdigris',
  'verdaccio', 'verditer', 'viridian', 'white-lead', 'whiting',
  'yellow-ochre', 'zinc-white',
];

export const colorOfArt: SourceContribution = {
  sourceKey: 'color-of-art',
  pool: 'material',
  words: WORDS,
  meta: {
    title: 'The Color of Art Pigment Database',
    url: 'https://www.artiscreation.com/Color_index_names.html',
    license: 'Permitted reference use, attribution',
    method: 'curated-from-domain',
    note: 'Representative seed; database is organized by Color Index pigment codes.',
  },
};
