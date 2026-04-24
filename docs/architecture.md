# Hero Syndrome — Architecture

## Stack summary

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast iteration, small bundle, deep ecosystem |
| Styling | Tailwind CSS | Rapid iteration; aesthetic is placeholder anyway |
| State | Zustand | Minimal, no boilerplate |
| PWA | `vite-plugin-pwa` | Installable on iOS home screen |
| Audio | Web Audio API | Crossfading, gain automation, analyzer nodes |
| Backend | Cloudflare Worker | Edge latency, free tier, single-file simplicity |
| Storage | Cloudflare R2 + KV | R2 for audio blobs; KV for session/episode metadata |
| LLM | Claude Haiku 4.5 (Anthropic API) | Fast, cheap, strong at short evocative writing |
| Music | ElevenLabs Music API | Already chosen; free credits available |
| Weather | Open-Meteo | Free, keyless, no auth |
| Geocoding | Nominatim (OpenStreetMap) | Free; must cache aggressively to respect TOS |
| Astrology | `astro-sweph` (Swiss Ephemeris, WASM, client-side) | Gold-standard precision, no auth, no rate limits, offline after first load |
| Auth | None (MVP) | Episodes identified by opaque URLs |

## System diagram

```
┌────────────────────────── Browser (iOS PWA) ──────────────────────────┐
│                                                                         │
│  Sensor layer ──► State aggregator ──► Prompt synthesizer              │
│  (geolocation,    (samples every 5s;    (fires on clip-boundary;       │
│   devicemotion,    produces State-        POSTs to /generate)          │
│   clock)           Vector)                                              │
│                                                                         │
│  Sticker UI ──► Sticker queue (with decay) ─┐                          │
│                                              ▼                          │
│                          Audio engine (Web Audio, 2-clip buffer,       │
│                          crossfaded, Media Session integration)        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌────────────────────── Cloudflare Worker ─────────────────────────────┐
│  POST /generate                                                      │
│    Req:  { sessionId, stateVector, stickers, recentHistory }         │
│    1. Build LLM prompt → Claude Haiku → music prompt                 │
│    2. ElevenLabs Music → audio clip                                  │
│    3. Store clip in R2                                               │
│    4. Append clip record to session in KV                            │
│    Ret:  { clipId, clipUrl, prompt, metadata, durationSec }          │
│                                                                       │
│  POST /episode/:sessionId/finalize                                   │
│  GET  /episode/:episodeId                                            │
│  GET  /geocode?lat&lon   (proxied Nominatim, KV-cached)              │
│  GET  /nearby?lat&lon    (proxied Overpass,  KV-cached)              │
│  GET  /weather?lat&lon   (proxied Open-Meteo, KV-cached)             │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ElevenLabs  │  Anthropic  │  Open-Meteo  │  Nominatim  │  Overpass
```

## Client architecture

### Sensor modules

Each sensor is a small module exposing a subscribe API.

- **`geolocation.ts`** — `navigator.geolocation.watchPosition()` with low-accuracy mode for battery. Emits `{ lat, lon, speedMps, heading }`.
- **`motion.ts`** — `DeviceMotionEvent` at ~10 Hz. Rolling-window (4s) RMS of the acceleration magnitude gives `intensityNormalized`. A small classifier combines intensity, GPS speed, and accel periodicity to produce `motionClass` and `movement.pattern` — see *Derivations* below.
- **`clock.ts`** — pure-function derivation of `phase` and `dayOfWeek` from `Date.now()` + lat/lon (for sunrise/sunset).

### Derived signals

- **`reverseGeocode.ts`** — calls backend `/geocode` proxy. The Worker returns the fully derived location bundle (`placeType`, `place`, `road`, `neighborhood`, `city`); the client stores it verbatim. The OSM-tag → `placeType` lookup lives in the Worker so it versions with the backend. Client-side cache keyed by rounded lat/lon (~3 decimal places).
- **`nearby.ts`** — calls backend `/nearby` proxy. Populates `location.nearby` with the top ~3 OSM POIs within ~150m (museums, stations, cafés, landmarks, etc.) so the LLM sees specific context beyond the coarse `placeType`. Refreshes only on significant location change (>~50m) because Overpass is rate-limited. Empty array is a valid state (no data, or upstream unavailable).
- **`weather.ts`** — calls backend `/weather` proxy. The proxy returns the already-populated `StateVector.weather` shape (WMO code mapped to `condition`, sunrise/sunset proximity computed). Refreshes every ~10 minutes or on significant location change.
- **`astrology.ts`** — optional signal. If the user completed the onboarding form (see below), computes the current astrological state relative to their natal chart using `astro-sweph` (Swiss Ephemeris WebAssembly) loaded lazily after session start. The natal chart is computed once and persisted in `localStorage`; thereafter only a transit snapshot (current planet positions + aspects to natal placements + moon phase) refreshes every ~15 minutes. If the user skipped onboarding, this module is a no-op and `stateVector.astrology` stays `undefined`.

### Onboarding (optional)

One-time modal at first app open offering **Add your astrology profile**. Three fields:

1. **Birth date** — date picker.
2. **Birth time** — time picker (with an "unknown" checkbox → we degrade to sun sign + rough moon only, skipping houses/rising).
3. **Birth location** — text field with Nominatim autocomplete (via an extended `/geocode` forward-lookup mode, or a lightweight client-side call). Resolves to lat/lon.

Once confirmed, the client:

1. Loads the `astro-sweph` WASM chunk (code-split; not on the critical path).
2. Computes the natal chart (sun/moon/rising signs, natal planet positions in degrees).
3. Persists the chart JSON in `localStorage` under `astrology.natal`.

The birth inputs themselves are **never** sent to the Worker — only the derived transit snapshot ships in the state vector. The user can clear their profile from settings; this also clears the `localStorage` entry.

### State aggregator

Every 5 seconds, samples all sources and composes the current `StateVector`. Stored in a Zustand store; consumed by the prompt synthesizer and any UI that cares.

### Prompt synthesizer

**At session start:** fires immediately after the prelude begins playing (see *Cold-start prelude* below). The prelude's metadata is the sole entry in `recentHistory` for clip 1.

**Steady state:** triggered when the currently-playing clip has ~5 seconds remaining:

1. Snapshot the current state vector.
2. Gather active (non-decayed) stickers.
3. Pull the last 2–3 clips' `{ clipId, metadata }` from the session store as `recentHistory`.
4. `POST /generate` with `{ sessionId, stateVector, stickers, recentHistory }`.
5. Stash the returned `metadata` in the session store for future `/generate` calls.
6. Hand the returned clip to the audio engine.

### Audio engine

- Web Audio API. Two `AudioBufferSourceNode`s, A and B.
- A plays. When A has ~3 seconds remaining, fetch and decode B.
- Crossfade: ramp A's gain from 1→0 and B's from 0→1 over 3–4 seconds.
- Swap roles. Repeat indefinitely.
- Media Session API exposes "Hero Syndrome — Scene 1" on the lock screen with start/end controls.
- An `AnalyserNode` on the master bus drives the live waveform visualization.

### Sticker layer

- Sticker palette lives in a curated JSON list.
- Drag-drop places a sticker at a position on the waveform. Each sticker records `{ emoji, placedAt, decayAt = placedAt + 5min }`.
- The Zustand store exposes `activeStickers()` which filters by `now < decayAt`.
- On clip boundary, active stickers are included in the `/generate` request.
- UI fades sticker opacity from 1 to 0 across its lifetime.

## Backend architecture

One Cloudflare Worker. All endpoints are stateless; all state lives in KV + R2.

### `POST /generate`

```
Request:  { sessionId, stateVector, stickers, recentHistory }
  - recentHistory: array of the last 2–3 clips' { clipId, metadata }
    sent by the client; the full per-clip record (prompt, stateVector,
    stickers) lives server-side in the session.
Steps:
  1. Build the LLM system+user prompt from the template (below), including
     recentHistory as continuity + anti-sameness context.
  2. Call Anthropic: model=claude-haiku-4-5, temperature=0.8, maxTokens=400,
     response_format=JSON. Parse { prompt, metadata }.
  3. Call ElevenLabs Music with `prompt`, target ~35s clip.
  4. Stream audio bytes to R2 at key `clips/{sessionId}/{clipId}.mp3`.
  5. Append { clipId, prompt, metadata, stateVector, createdAt } to the
     session record in KV at key `sessions/{sessionId}`.
  6. Return { clipId, clipUrl, prompt, metadata, durationSec }.
Failure modes:
  - LLM fails:          fall back to a deterministic prompt+metadata derived
                        from the state vector via a rule table.
  - LLM JSON malformed: retry once; on second failure, extract prompt text
                        and synthesize metadata deterministically.
  - Music fails:        retry once with the same prompt; then surface an
                        error to the client, which extends the current clip
                        via tail-loop.
```

### `POST /episode/:sessionId/finalize`

```
Request:  { title?, endedAt }
Steps:
  1. Load session from KV.
  2. If no title, ask Claude to generate one from the signal/sticker timeline.
  3. Write `episodes/{episodeId}` with a fresh opaque ULID.
  4. Return { episodeId, shareUrl }.
```

### `GET /episode/:id`

Returns episode metadata (title, start/end, clip list with timestamps, sticker events, sparse state-vector samples). Clip URLs resolve through the Worker so we can control caching and optionally sign.

### `GET /geocode`

Two modes, dispatched by query params:

**Reverse — `?lat=&lon=`.** Proxies Nominatim reverse geocoding (`zoom=18`, `addressdetails=1`). The Worker derives `placeType` from the response's primary `category` + `type` via the lookup table in *Derivations*, and returns the bundle:

```ts
{
  placeType: string,                    // coarse bucket
  place?: { category, type, name? },    // raw OSM passthrough — "tourism/museum/Tate Modern"
  road?: { class, name? },              // populated when nearest feature is a road
  neighborhood?: string,                // address.neighbourhood || suburb || city_district
  city?: string
}
```

The raw Nominatim payload is NOT returned to the client — only the derived bundle. KV cache keyed by `geo:{roundedLat}:{roundedLon}`, 30-day TTL.

**Forward — `?q=<text>`.** Proxies Nominatim search (`/search`) for the onboarding birth-location autocomplete. Returns up to 5 matches ranked by OSM `importance`:

```ts
Array<{
  lat: number,
  lon: number,
  displayName: string,   // Nominatim's formatted name
  city?: string,
  country?: string
}>
```

KV cache keyed by `geo-fwd:{normalizedQuery}` (trimmed + lowercased + collapsed whitespace), 30-day TTL. Empty or <3-char queries short-circuit to `[]` without hitting Nominatim.

### `GET /nearby?lat=&lon=`

Proxies Overpass. Single `around:150` query selecting `tourism=*`, `amenity=*`, `historic=*`, `leisure=*`, `natural~"water|beach"`, `railway=station`. Returns the top ~3 results ranked by OSM `importance` as `[{ category, type, name?, distanceM }]`.

KV cache keyed by `poi:{roundedLat}:{roundedLon}`, 30-day TTL (POIs rarely change). Overpass has stricter usage rules than Nominatim — the endpoint must be cache-first and must degrade to `[]` gracefully if the upstream fails or rate-limits. Client treats empty array as "no data", not an error.

### `GET /weather?lat=&lon=`

Proxies Open-Meteo. Requests:

- `current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day`
- `daily=sunrise,sunset`

The Worker maps `weather_code` → `condition` via the WMO table in *Derivations*, computes `sunriseProximityMin` / `sunsetProximityMin` from the current time against today's sunrise/sunset, and returns the fully populated `StateVector.weather` shape. No API key required for non-commercial use. KV cache keyed by `wx:{roundedLat}:{roundedLon}`, 10-minute TTL.

## Data schemas

```typescript
type StateVector = {
  timestamp: string; // ISO
  time: {
    hour: number;
    phase: 'dawn' | 'morning' | 'noon' | 'afternoon'
         | 'goldenHour' | 'dusk' | 'night' | 'witchingHour';
    dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  };
  weather?: {
    tempC: number;
    feelsLikeC: number;
    humidityPct: number;                // 0..100
    condition: string;                  // mapped WMO code, e.g. 'drizzle' — see Derivations
    precipitationMmHr: number;
    cloudCoverPct: number;              // 0..100
    windMps: number;
    isDay: boolean;
    sunriseProximityMin: number;        // negative = before sunrise
    sunsetProximityMin: number;
  };
  location?: {
    speedMps: number;
    motionClass: 'still' | 'walking' | 'running' | 'vehicle';
    placeType: 'park' | 'urban' | 'residential' | 'coast' | 'water'
             | 'forest' | 'rural' | 'industrial' | 'transit' | 'unknown';
    place?: {
      category: string;                 // 'tourism' | 'railway' | 'amenity' | 'highway' | 'leisure' | 'natural' | ...
      type: string;                     // 'museum' | 'station' | 'cafe' | 'motorway' | 'park' | 'beach' | ...
      name?: string;                    // "Tate Modern", "King's Cross", "M25"
    };
    road?: {
      class: string;                    // 'motorway' | 'trunk' | 'primary' | 'residential' | 'footway' | ...
      name?: string;
    };
    nearby?: Array<{
      category: string;
      type: string;
      name?: string;
      distanceM: number;
    }>;
    neighborhood?: string;
    city?: string;
  };
  movement: {
    intensityNormalized: number;        // 0..1
    pattern: 'still' | 'steady' | 'rhythmic' | 'erratic';
  };
  astrology?: {                          // present only if user completed onboarding
    natal: {
      sunSign: ZodiacSign;
      moonSign: ZodiacSign;
      risingSign?: ZodiacSign;           // absent if birth time was unknown
    };
    nowMoon: {
      phase: 'new' | 'waxing-crescent' | 'first-quarter' | 'waxing-gibbous'
           | 'full' | 'waning-gibbous' | 'last-quarter' | 'waning-crescent';
      sign: ZodiacSign;
      illuminationPct: number;            // 0..100
    };
    transits: Array<{
      transiting: Planet;                 // 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
                                          //   | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
      aspect: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
      natal: Planet | 'ascendant' | 'midheaven';
      orbDeg: number;                     // tightness of the aspect in degrees; smaller = more intense
    }>;                                   // filtered to orb < 2° and natal targets in {sun, moon, ascendant, venus, mars}
  };
};

type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

type Planet =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars'
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

type Sticker = {
  emoji: string;
  placedAt: string;
  decayAt: string;
  // effective intensity = 1 - (now - placedAt) / (decayAt - placedAt), clamped to [0, 1]
};

type ClipMetadata = {
  bpmRange: [number, number];            // e.g. [60, 72]
  key: string;                            // "D minor" | "C mixolydian" | "modal/ambiguous"
  intensity: number;                      // 0..1
  instrumentation: string[];              // ["solo cello", "warm pads", "tape hiss"]
  genreTags: string[];                    // ["neo-classical", "drone", "ambient"]
  transitionIntent: 'evolve' | 'shift' | 'break';
  // evolve = neighboring prior clip; shift = intentional pivot;
  // break = hard cut (sticker change or sharp state change)
};

type SessionRecord = {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  clips: Array<{
    clipId: string;
    startedAt: string;
    durationSec: number;
    prompt: string;
    metadata: ClipMetadata;
    stateVector: StateVector;
    stickers: Sticker[];
  }>;
  stickerEvents: Array<{ emoji: string; placedAt: string }>;
};

type EpisodeRecord = SessionRecord & {
  episodeId: string;
  title: string;
};
```

## Derivations

The mappings below fully specify how raw sensor and upstream-API data become `StateVector` fields. Place and weather derivations run server-side (in the Worker) so the lookup tables version with the backend; motion classification runs on-device.

### `placeType` from OSM tags

Applied to the Nominatim response's primary `category` + `type` (or selected `address` / `extratags`) in priority order — first match wins. The raw `category`, `type`, and `name` also pass through in `location.place`, so the LLM sees "tourism / museum / Tate Modern", not just the coarse bucket.

| OSM tag                                                        | `placeType`    |
|----------------------------------------------------------------|----------------|
| `leisure=park` / `boundary=national_park`                      | `park`         |
| `natural=beach` / `natural=coastline`                          | `coast`        |
| `natural=water` / `waterway=*`                                 | `water`        |
| `natural=wood` / `landuse=forest`                              | `forest`       |
| `railway=station` / `aeroway=*` / `public_transport=station`   | `transit`      |
| `landuse=industrial`                                           | `industrial`   |
| `landuse=residential` / `place=suburb`                         | `residential`  |
| `place=village` / `place=hamlet` / `landuse=farmland`          | `rural`        |
| `amenity=*` / `shop=*` / `landuse=commercial\|retail`          | `urban`        |
| `highway=motorway\|trunk\|primary`                             | `urban` (road surfaces via `road.class`) |
| `highway=residential\|footway\|service`                        | `residential`  |
| fallback                                                       | `unknown`      |

### WMO `weather_code` → `condition`

Applied to Open-Meteo's `current.weather_code`.

| WMO code(s)   | `condition`           |
|---------------|-----------------------|
| 0             | `clear`               |
| 1, 2          | `mainly-clear`        |
| 3             | `overcast`            |
| 45, 48        | `fog`                 |
| 51, 53, 55    | `drizzle`             |
| 56, 57        | `freezing-drizzle`    |
| 61, 63, 65    | `rain`                |
| 66, 67        | `freezing-rain`       |
| 71, 73, 75    | `snow`                |
| 77            | `snow-grains`         |
| 80, 81, 82    | `rain-showers`        |
| 85, 86        | `snow-showers`        |
| 95            | `thunderstorm`        |
| 96, 99        | `thunderstorm-hail`   |

### Motion classifier

Thresholds below are starting points — they must be tuned empirically during the motion-sensing spike. All windowed statistics are computed on the acceleration-magnitude signal (minus gravity) over a rolling 4-second window at ~10 Hz.

**`motionClass`** — first match wins:

| Condition                                                         | `motionClass` |
|-------------------------------------------------------------------|---------------|
| sustained GPS speed > 7 m/s (~25 km/h) for ≥ 10 s                 | `vehicle`     |
| dominant accel periodicity 2.5–3.5 Hz AND intensity > 0.3         | `running`     |
| dominant accel periodicity 1.5–2.5 Hz AND intensity in [0.05, 0.3]| `walking`     |
| intensity < 0.05                                                  | `still`       |
| fallback                                                          | `still`       |

"Dominant periodicity" is the peak frequency of the autocorrelation (or a small FFT) of the window.

**`movement.pattern`** — derived from the same window:

| Condition                                                           | `pattern`  |
|---------------------------------------------------------------------|------------|
| variance < 0.02                                                     | `still`    |
| variance ≥ 0.02 AND autocorr peak > 0.6 at a lag in [0.3 s, 1.0 s]  | `rhythmic` |
| variance ≥ 0.02 AND autocorr peak ≤ 0.6                             | `erratic`  |
| otherwise                                                           | `steady`   |

**Sticky filter:** require 2 consecutive windows to agree before switching `motionClass` or `pattern`, to avoid flicker on boundary values.

## Prompt synthesis template

Single-turn Claude Haiku call with structured JSON output.

```
System:
You are the composer for a film of this person's life. You write the score
one clip at a time, reading the current state of the person's world and any
emoji "mood stickers" they've placed.

Output a single JSON object:

{
  "metadata": {
    "bpmRange": [number, number],
    "key": string,                        // "D minor" | "C mixolydian" | "modal/ambiguous"
    "intensity": number,                  // 0..1
    "instrumentation": [string, ...],
    "genreTags": [string, ...],
    "transitionIntent": "evolve" | "shift" | "break"
  },
  "prompt": string                        // 25–60 words, evocative prose
}

RULES:
- The `prompt` is sent verbatim to ElevenLabs Music. ElevenLabs sees only the
  prompt, not the metadata. The prompt MUST explicitly embed the metadata
  values — state the BPM (or a narrow range), key/mode, lead instrumentation,
  and intensity descriptor in the prose. The `metadata` field is a label of
  what the prompt describes; they must agree.
- Use `recentHistory` as continuity + anti-sameness context. Each clip must
  have its own character — do not repeat prior prompts or prior metadata
  values verbatim. Decide whether to `evolve` (neighboring prior clip),
  `shift` (intentional pivot), or `break` (hard cut) based on how state has
  changed, and record the choice in `transitionIntent`.
- Instrumental only — no lyrics, no vocal lines.
- Prefer specific over abstract. Cinematic but never obvious. Avoid clichés.

User:
State: {state_vector_json}
Active stickers: {stickers_json}
Recent history (most recent last): {recent_history_json}

Return ONLY the JSON object. No preamble, no markdown fences, no commentary.
```

The parsed `prompt` is passed verbatim to ElevenLabs Music. The full
{ prompt, metadata, stateVector } is stored with every clip — subsequent
clips read `metadata` from `recentHistory` as their continuity context.

## Cold-start prelude

The first clip can't wait for LLM + ElevenLabs generation — that's 10–30 seconds of silence after Start. Solution: **25 pre-generated prelude clips**, deterministically indexed by the initial state vector. The client picks one, plays it immediately, and `/generate` fires in parallel for clip 1. A standard crossfade hands off from prelude into the live stream.

### Bucketing scheme

A 5×5 grid over the two signals reliably available at app start:

- **Time phase (5):** `early` (dawn + morning) · `day` (noon + afternoon) · `gold` (golden hour) · `dusk` (dusk + night) · `deep` (witching hour)
- **Intensity quintile (5):** `dormant` [0.0–0.2) · `still` [0.2–0.4) · `gentle` [0.4–0.6) · `active` [0.6–0.8) · `intense` [0.8–1.0]

If `movement.intensityNormalized` hasn't stabilized within ~2 seconds of Start, default to the `still` quintile. Bucketing is a pure function of the state vector — same inputs always return the same prelude.

Weather and location are intentionally excluded: they often haven't loaded at session start, and the prelude only needs to be *plausibly* right. Clip 1 adapts to the full state vector.

### Manifest

Served as a static `preludes/manifest.json` from R2 (CDN-cached):

```typescript
type PreludeManifest = {
  version: string;
  clips: Array<{
    id: string;                         // e.g. "gold_gentle"
    timePhase: 'early' | 'day' | 'gold' | 'dusk' | 'deep';
    intensity: 'dormant' | 'still' | 'gentle' | 'active' | 'intense';
    audioUrl: string;                   // R2 URL
    durationSec: number;
    prompt: string;                     // prompt used to generate (for debugging)
    metadata: ClipMetadata;             // same schema as live clips
  }>;
};
```

### Client flow at session start

1. User taps **Start scene**.
2. Client reads `preludes/manifest.json` (warm-cached after first app open).
3. Client computes bucket key from current state vector → selects clip entry.
4. Fetch `audioUrl`, decode, begin playback immediately.
5. In parallel, `POST /generate` for clip 1 with `recentHistory = [preludeMetadata]` so clip 1 evolves from the prelude's musical character.
6. Standard crossfade replaces the prelude when clip 1 is ready.
7. From clip 1 onward, normal continuous-playback flow.

If clip 1 is late, the prelude tail-loops under a low-pass filter (same fallback as any late clip).

### Offline generation

Preludes are produced by a one-shot CLI (`apps/prelude-gen`) that:

1. Iterates 25 canonical state vectors (time phase × intensity quintile, with representative weather and a neutral location).
2. Runs each through the same LLM + ElevenLabs pipeline used by `/generate`, with empty `recentHistory` (these are seeds).
3. Uploads `preludes/{id}.mp3` and writes `preludes/manifest.json` to R2.

Run on demand — after prompt-template changes or to rotate aesthetics. Not part of the runtime path.

## Session lifecycle

A **session** is one continuous listening experience — may span tens of minutes to hours of crossfaded clips. A finalized session becomes an **episode**: a shareable, frozen recording of what was played.

### Starting a session

1. User taps **Start scene**.
2. Client generates a fresh `sessionId` as a ULID. No server round-trip — the ID is local.
3. Client kicks off the cold-start prelude (see above) and `POST /generate` for clip 1 in parallel.
4. The first `/generate` call creates the session record in KV (`sessions/{sessionId}`) lazily. There is no explicit "create session" endpoint.

### While the session is running

- `sessionId` lives in the Zustand store (in-memory only).
- Every `/generate` call references the same `sessionId` and appends a clip record to the KV session.
- **Rate limit:** `POST /generate` is capped at 1 request per 10 seconds per `sessionId` (Cloudflare rate-limiting binding keyed by sessionId). Guards against client-side runaway loops without restricting normal clip-boundary generation (~once per 25–40s).

### Ending a session

Three ways a session ends, in priority order:

1. **Explicit.** User taps **End scene**. Client fades audio out, calls `POST /episode/:sessionId/finalize`, navigates to the returned `shareUrl`.
2. **Idle timeout.** If the PWA is backgrounded or the tab is hidden for >30 minutes, the client auto-finalizes on next visibility restoration. The next Start tap begins a fresh session.
3. **Abrupt close.** If the tab/app is killed without warning, no finalize fires. The KV session record persists un-finalized.

### Housekeeping

- **KV TTL:** un-finalized session records expire after 7 days. Episodes have no TTL.
- **Resumption:** out of scope for MVP — each Start tap always yields a new session. Persisting an in-progress session across reloads could be added later via `sessionStorage`, but isn't needed for the art piece's use case.

## Playback strategy

- **Target clip length:** 30–45 seconds. Balances generation latency against adaptation rate.
- **Crossfade:** 3–4 seconds.
- **Generation lead time:** kick off clip N+1 at `T-minus-(measuredLatency + crossfadeWindow)`. Measure rolling latency per session; adapt.
- **Late next clip:** extend A via a short tail-loop on a low-pass filter rather than going silent.
- **Failed generation:** retry once with the prior prompt; if still failing, surface a small UI hint and continue A.

## Privacy

- Location and motion stay on device where possible. The backend sees the aggregated `StateVector` (with place labels, not raw coords) — except for `/geocode`, `/nearby`, and `/weather` calls, which must proxy raw lat/lon.
- **Astrology birth data (date, time, location) never leaves the device.** The natal chart is computed client-side via `astro-sweph` and persisted in `localStorage`. Only the derived transit snapshot (signs, aspects, orbs) ships in the state vector to the Worker. A "Clear astrology profile" control in settings wipes the `localStorage` entry.
- Session and episode IDs are random ULIDs. No personal identifiers anywhere.
- Episode URLs are unguessable; no auth required to share or access.
- API keys (ElevenLabs, Anthropic) are held only on the Worker.
- Rate-limit `/generate` per `sessionId` to prevent runaway loops.

## Deployment

- **Frontend:** Cloudflare Pages (HTTPS required for PWA + sensors).
- **Backend:** Cloudflare Worker + R2 bucket + KV namespace, single project.
- **Repo layout:**

```
hero-syndrome/
├─ apps/web/          # Vite React PWA
├─ apps/worker/       # Cloudflare Worker
├─ packages/shared/   # StateVector, Sticker, API types
└─ docs/              # concept.md, architecture.md
```

## Open technical questions

1. **ElevenLabs Music latency & clip length.** Needs empirical measurement. The buffer math assumes generation completes within a ~30s clip. If not, we lengthen clips or increase buffer depth.
2. **Waveform visualization source.** Analyzer node on the master bus (literal audio waveform) vs. a stylized signal-driven animation that *looks* like a waveform but is really driven by state. Design call.
3. **iOS Safari audio session.** Playback must start from a user gesture (the Start button handles this). Mute-switch behavior and Media Session control coverage inside a PWA need verification on-device.
4. **Geolocation battery cost.** `watchPosition` with high accuracy is expensive. Default to low-accuracy + longer intervals; only bump accuracy if the session is long or movement is high.
5. **Does ElevenLabs honor numeric musical terminology?** The design assumes the music model honors explicit BPM numbers and key signatures written in the prompt. If it only loosely follows (treats "72 BPM" as "moderate-ish"), we shift the prompt style toward descriptive tempo words + narrow ranges rather than exact numbers. Our metadata contract on the LLM side still holds either way. Measure during the spike.
6. **OSM usage rules.** Nominatim AND Overpass have strict usage policies. The `/geocode` and `/nearby` proxies must cache aggressively (already in the design) and identify themselves per the TOS. Need a commercial fallback (Mapbox, Stadia Maps?) if we share this more broadly than a demo.
7. **Motion classifier thresholds.** The numbers in *Derivations* are placeholders. Collect real traces during the spike — particularly for `walking` vs `still` on a phone held loosely vs. in a pocket, and `vehicle` false-positives on fast escalators / trains.
8. **`astro-sweph` bundle cost.** The WASM + ephemeris data files add ~2–3 MB. Code-split and lazy-load them *after* session start so they never block first audio. If the total budget still feels heavy, strip to a date-range-limited ephemeris (current decade only) or fall back to a Worker-hosted ephemeris endpoint. Also confirm WASM runs cleanly inside the iOS PWA shell.
9. **Prelude bucketing scheme.** The 5×5 time-phase × intensity-quintile grid is a starting point. Production telemetry will show which buckets most cold starts fall into; we may want to weight slots unevenly, expand to 50, or introduce a secondary axis (weather?) once we have data.
