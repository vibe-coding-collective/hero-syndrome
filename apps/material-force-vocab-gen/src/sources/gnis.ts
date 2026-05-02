import type { SourceContribution } from './types';

// Generic geographic feature terms drawn from the USGS Geographic Names
// Information System (GNIS) feature classes and from common US topographic
// generic terms. Single-word generic landform vocabulary.
const WORDS = [
  'arroyo', 'badlands', 'bar', 'basin', 'bay', 'beach', 'bench', 'bight',
  'bluff', 'bog', 'bottom', 'brook', 'butte', 'caldera', 'canyon', 'cape',
  'cataract', 'cave', 'channel', 'cirque', 'cliff', 'col', 'coulee', 'cove',
  'crag', 'crater', 'crest', 'cul-de-sac', 'dale', 'delta', 'divide',
  'doline', 'draw', 'drumlin', 'dune', 'eddy', 'erratic', 'escarpment',
  'esker', 'estuary', 'falls', 'fen', 'fissure', 'fjord', 'foothill', 'ford',
  'fork', 'gap', 'glacier', 'glade', 'gorge', 'gulch', 'gully', 'harbor',
  'headland', 'heath', 'hillock', 'hollow', 'horn', 'hummock', 'inlet',
  'island', 'isthmus', 'jetty', 'kame', 'karst', 'kettle', 'knoll', 'lagoon',
  'ledge', 'levee', 'mead', 'meadow', 'mesa', 'moor', 'moraine', 'mountain',
  'narrows', 'oasis', 'outcrop', 'oxbow', 'palisade', 'pass', 'peak',
  'peninsula', 'pinnacle', 'plateau', 'point', 'pond', 'prairie', 'reef',
  'ridge', 'rift', 'rivulet', 'sandbar', 'savanna', 'scarp', 'scree', 'seep',
  'shoal', 'sinkhole', 'slough', 'spit', 'spring', 'spur', 'strait', 'swale',
  'swamp', 'tarn', 'terrace', 'thicket', 'tidepool', 'tor', 'tributary',
  'tundra', 'valley', 'wadi', 'watershed', 'wetland',
];

export const gnis: SourceContribution = {
  sourceKey: 'usgs-gnis',
  pool: 'material',
  words: WORDS,
  meta: {
    title: 'USGS Geographic Names Information System (GNIS) generic feature terms',
    url: 'https://www.usgs.gov/us-board-on-geographic-names/gnis-domestic-names-feature-classes',
    license: 'Public domain (US government work)',
    method: 'curated-from-domain',
    note: 'Generic landform vocabulary; full GNIS database has ~2.3M named features but uses ~63 generic feature classes.',
  },
};
