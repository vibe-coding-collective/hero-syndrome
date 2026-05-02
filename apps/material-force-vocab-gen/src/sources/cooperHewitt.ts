import type { SourceContribution } from './types';

// Textile material and weave-type vocabulary in the register of the Cooper
// Hewitt Smithsonian Design Museum's textile collection. Single-word terms
// representing common fabrics, weaves, and finishes; combined with terms
// from the 1909 Encyclopedia of Textiles (Henry William Schofield) on
// Project Gutenberg.
const WORDS = [
  'alpaca', 'baize', 'baldachin', 'barathea', 'batiste', 'bombazine', 'bouclé',
  'brocade', 'broadcloth', 'buckram', 'burlap', 'calico', 'cambric', 'canvas',
  'cashmere', 'challis', 'chambray', 'cheviot', 'chenille', 'chiffon',
  'chintz', 'cisele', 'corduroy', 'crepe', 'cretonne', 'damask', 'denim',
  'dimity', 'doeskin', 'doubleknit', 'drill', 'duck', 'dupioni', 'faille',
  'felt', 'flannel', 'foulard', 'gabardine', 'galloon', 'gauze', 'georgette',
  'gimp', 'gingham', 'gossamer', 'grenadine', 'grosgrain', 'haircloth',
  'hemp', 'henrietta', 'herringbone', 'hessian', 'holland', 'huckaback',
  'jacquard', 'jersey', 'kashmir', 'lace', 'lampas', 'lawn', 'linen',
  'linsey-woolsey', 'mackintosh', 'madras', 'mohair', 'moire', 'moleskin',
  'mousseline', 'mull', 'muslin', 'nainsook', 'oilcloth', 'organdie',
  'organza', 'orleans', 'osnaburg', 'paisley', 'panne', 'percale', 'piqué',
  'plush', 'poplin', 'pongee', 'rep', 'sailcloth', 'samite', 'sateen',
  'satin', 'seersucker', 'serge', 'shantung', 'sicilian', 'silk', 'silesia',
  'soutache', 'taffeta', 'tarlatan', 'ticking', 'tulle', 'tussore', 'tweed',
  'twill', 'velour', 'velvet', 'velveteen', 'voile', 'webbing', 'wincey',
  'worsted',
];

export const cooperHewitt: SourceContribution = {
  sourceKey: 'cooper-hewitt-textiles',
  pool: 'material',
  words: WORDS,
  meta: {
    title: 'Cooper Hewitt textile thesaurus + Encyclopedia of Textiles (Schofield, 1909)',
    url: 'https://collection.cooperhewitt.org/objects/?department=textiles',
    license: 'CC0 (Smithsonian collection metadata) + PD (Schofield)',
    method: 'curated-from-domain',
    note: 'Single-word fabric/weave/finish terms.',
  },
};
