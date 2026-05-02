import type { SourceContribution } from './types';

// Representative seed list of IMA-recognized mineral species. The canonical
// list (~5,900 entries) lives at the RRUFF Project's IMA mineral list. The
// names below are drawn from that list. To expand, run a live extraction
// against the canonical source.
const WORDS = [
  'amazonite', 'amblygonite', 'amethyst', 'andesine', 'anhydrite', 'anorthite',
  'apatite', 'apophyllite', 'aquamarine', 'aragonite', 'arsenopyrite', 'augite',
  'autunite', 'axinite', 'azurite', 'barite', 'baryte', 'beryl', 'biotite',
  'bornite', 'brookite', 'calcite', 'cassiterite', 'celestine', 'cerussite',
  'chabazite', 'chalcedony', 'chalcocite', 'chalcopyrite', 'chiastolite',
  'chlorite', 'chromite', 'chrysoberyl', 'chrysocolla', 'chrysoprase',
  'cinnabar', 'citrine', 'cobaltite', 'columbite', 'cordierite', 'corundum',
  'cristobalite', 'crocoite', 'cryolite', 'cuprite', 'cyanite', 'datolite',
  'diopside', 'dolomite', 'dumortierite', 'enstatite', 'epidote', 'fluorite',
  'forsterite', 'galena', 'garnet', 'glauconite', 'goethite', 'graphite',
  'gypsum', 'halite', 'hematite', 'hornblende', 'howlite', 'hypersthene',
  'iolite', 'jadeite', 'kaolinite', 'kernite', 'kunzite', 'kyanite',
  'labradorite', 'lazulite', 'lazurite', 'lepidolite', 'leucite', 'limonite',
  'magnesite', 'magnetite', 'malachite', 'marcasite', 'mica', 'microcline',
  'molybdenite', 'monazite', 'montmorillonite', 'moonstone', 'morganite',
  'muscovite', 'nepheline', 'obsidian', 'olivine', 'onyx', 'opal',
  'orthoclase', 'peridot', 'perovskite', 'phenakite', 'plagioclase',
  'prehnite', 'proustite', 'pyrite', 'pyrolusite', 'pyromorphite', 'pyrope',
  'pyrrhotite', 'quartz', 'realgar', 'rhodochrosite', 'rhodonite', 'rutile',
  'sanidine', 'sapphire', 'scapolite', 'scheelite', 'schorl', 'selenite',
  'sepiolite', 'serpentine', 'siderite', 'sillimanite', 'smithsonite',
  'sodalite', 'spessartine', 'sphalerite', 'sphene', 'spinel', 'spodumene',
  'staurolite', 'stibnite', 'stilbite', 'sugilite', 'sulfur', 'sylvite',
  'talc', 'tanzanite', 'tetrahedrite', 'thomsonite', 'topaz', 'tourmaline',
  'tremolite', 'turquoise', 'unakite', 'uvarovite', 'vanadinite',
  'vermiculite', 'vesuvianite', 'wavellite', 'willemite', 'witherite',
  'wolframite', 'wollastonite', 'wulfenite', 'zincite', 'zircon', 'zoisite',
];

export const rruff: SourceContribution = {
  sourceKey: 'rruff',
  pool: 'material',
  words: WORDS,
  meta: {
    title: 'RRUFF Project — IMA Mineral List',
    url: 'https://www.rruff.net/ima/',
    license: 'Public scientific record (IMA-CNMNC)',
    method: 'curated-from-domain',
    note: 'Representative seed; full IMA list contains ~5,900 species.',
  },
};
