import type { SourceContribution } from './types';

// Goods of long-distance pre-modern commerce as named in Hakluyt's Principal
// Navigations (1589–1600), Marco Polo's Travels (Yule-Cordier ed.), and
// Mandeville's Travels — all on Project Gutenberg.
const WORDS = [
  'aloeswood', 'ambergris', 'amber', 'aniseed', 'arrack', 'attar',
  'balsam', 'benzoin', 'betel', 'brazilwood', 'calicut', 'camlet', 'camphor',
  'cardamom', 'cassia', 'cinnamon', 'civet', 'cloves', 'cochineal', 'copal',
  'coriander', 'cubebs', 'cumin', 'damascene', 'dammar', 'eaglewood',
  'fenugreek', 'frankincense', 'galangal', 'galbanum', 'galingale', 'ginger',
  'guaiacum', 'gum-arabic', 'gum-tragacanth', 'hennaorange', 'henna',
  'incense', 'indigo', 'ivory', 'jasper', 'kohl', 'lac', 'lacquer',
  'lapis-lazuli', 'mace', 'manna', 'mastic', 'mother-of-pearl', 'musk',
  'myrrh', 'nard', 'nutmeg', 'oakum', 'olibanum', 'opium', 'pearl',
  'peppercorn', 'pimento', 'porcelain', 'rhubarb', 'rice', 'rose-attar',
  'rosewater', 'sable', 'saffron', 'sago', 'sandalwood', 'sappanwood',
  'sassafras', 'satinwood', 'scammony', 'senna', 'sesame', 'sesame-oil',
  'shagreen', 'silk-floss', 'spikenard', 'storax', 'sugar-loaf', 'sugarcane',
  'sumac', 'sweetwood', 'tamarind', 'teakwood', 'tobacco', 'tortoiseshell',
  'turmeric', 'turpentine', 'vellum', 'vermillion', 'vetiver', 'walrus-ivory',
  'wax', 'wormwood', 'yew', 'ylang',
];

export const silkRoad: SourceContribution = {
  sourceKey: 'silk-road-travel-narratives',
  pool: 'material',
  words: WORDS,
  meta: {
    title: 'Hakluyt, Marco Polo, Mandeville — silk road / spice trade goods',
    url: 'https://www.gutenberg.org/ebooks/search/?query=hakluyt',
    license: 'PD (pre-1929 publications)',
    method: 'curated-from-domain',
    note: 'Trade-good vocabulary curated from the three travel-narrative corpora; Project Gutenberg IDs span Hakluyt 11342, Marco Polo 10636/12410, Mandeville 782.',
  },
};
