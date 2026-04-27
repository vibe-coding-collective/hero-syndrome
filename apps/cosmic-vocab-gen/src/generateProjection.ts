function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface ProjectionMatrix {
  version: string;
  rows: number;
  cols: number;
  values: number[];
}

export function generateProjection(rows = 13, cols = 384, seed = 42): ProjectionMatrix {
  const rand = mulberry32(seed);
  const values = new Array<number>(rows * cols);
  const scale = 1 / Math.sqrt(rows);
  for (let i = 0; i < values.length; i++) values[i] = gaussian(rand) * scale;
  return { version: `random.${rows}x${cols}.seed${seed}`, rows, cols, values };
}
