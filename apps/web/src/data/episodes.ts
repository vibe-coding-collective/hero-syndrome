export type TraceVariant =
  | 'walking'
  | 'still'
  | 'rain'
  | 'transit'
  | 'dusk'
  | 'gold'

export type EpisodeSeed = {
  id: string
  number: number
  title: string
  byline: string
  dateline: string
  runtimeMin: number
  trace: TraceVariant
  annotation: string
  cosmicWord?: string
}

export const featured: EpisodeSeed = {
  id: '01HZ7Q4COVERSTORY',
  number: 14,
  title: 'Walking home, rain starting, three stickers deep',
  byline: 'a stranger in Berlin',
  dateline: 'Apr 24 · 2026',
  runtimeMin: 24,
  trace: 'rain',
  annotation:
    'fig. 1 · accelerometer rising at 18.42, weather flips to drizzle at 18.46, 🌧️ at 18.47.',
  cosmicWord: 'kindling',
}

export const archive: EpisodeSeed[] = [
  {
    id: '01HZ7Q5SUNDAYSLOW',
    number: 13,
    title: 'Sunday, slow, mostly indoors',
    byline: 'a stranger in Lisbon',
    dateline: 'Apr 21 · 2026',
    runtimeMin: 41,
    trace: 'still',
    annotation: 'fig. 2 · overcast, low motion, two stickers across two hours.',
  },
  {
    id: '01HZ7Q6BUSGOLD',
    number: 12,
    title: 'On a bus, golden hour, no one talking',
    byline: 'a stranger in Mexico City',
    dateline: 'Apr 19 · 2026',
    runtimeMin: 18,
    trace: 'transit',
    annotation: 'fig. 3 · vehicle motion class, sunset proximity 12 min.',
  },
  {
    id: '01HZ7Q7BEFORESTORM',
    number: 11,
    title: 'Running before the storm',
    byline: 'a stranger in Brooklyn',
    dateline: 'Apr 17 · 2026',
    runtimeMin: 9,
    trace: 'walking',
    annotation:
      'fig. 4 · accelerometer periodicity 2.8 Hz, pressure dropping, ⚡️ × 2.',
  },
  {
    id: '01HZ7Q8WINDOWREAD',
    number: 10,
    title: 'Reading near a window, dusk arriving',
    byline: 'a stranger in Kyoto',
    dateline: 'Apr 14 · 2026',
    runtimeMin: 53,
    trace: 'dusk',
    annotation:
      'fig. 5 · still for 50 min, light dropping past sunset proximity.',
  },
  {
    id: '01HZ7Q9HARBORWALK',
    number: 9,
    title: 'A walk along the harbor, alone',
    byline: 'a stranger in Marseille',
    dateline: 'Apr 11 · 2026',
    runtimeMin: 27,
    trace: 'gold',
    annotation:
      'fig. 6 · coastal placeType, golden phase, walking pattern, steady.',
  },
]
