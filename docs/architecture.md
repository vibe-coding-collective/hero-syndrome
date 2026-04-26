# Hero Syndrome — Architecture

## Stack summary

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast iteration, small bundle, deep ecosystem |
| Styling | Tailwind CSS | Rapid iteration; aesthetic is placeholder anyway |
| State | Zustand | Minimal, no boilerplate |
| PWA | `vite-plugin-pwa` | Installable on iOS home screen |
| Audio | Web Audio API | Two-buffer playlist queue, gain automation, analyzer nodes |
| Backend | Cloudflare Worker + Durable Objects | Edge latency, free tier; DO gives strongly-consistent per-session state |
| Storage | Cloudflare R2 + KV | R2 for audio blobs; KV for episode index + upstream proxy cache (sessions live in DO storage) |
| LLM | Claude Haiku 4.5 (Anthropic API) | Fast, cheap, strong at short evocative writing |
| Music | ElevenLabs Music API | Already chosen; free credits available |
| Weather | Open-Meteo | Free, keyless, no auth |
| Geocoding | Nominatim (OpenStreetMap) | Free; must cache aggressively to respect TOS |
| Auth | None (MVP) | Episodes identified by opaque URLs |

## System diagram

```
┌────────────────────────── Browser (iOS PWA) ──────────────────────────┐
│                                                                         │
│  Sensor layer ──► State aggregator ──► Song synthesizer                │
│  (geolocation,    (samples every 5s;    (fires before song ends;       │
│   devicemotion,    produces State-        POSTs to /generate)          │
│   clock)           Vector)                                              │
│                                                                         │
│  Sticker UI ──► Sticker queue (with decay) ─┐                          │
│                                              ▼                          │
│                          Audio engine (Web Audio, 2-song playlist      │
│                          queue, Media Session integration)             │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌────────── Cloudflare Worker (router) + Session Durable Object ────────┐
│  POST /generate                                                        │
│    Req:  { sessionId, stateVector, stickers, recentHistory }           │
│    1. Build LLM prompt → Claude Haiku (tool use) → composition_plan    │
│    2. ElevenLabs Music with composition_plan → full song audio         │
│    3. Stream song into R2                                              │
│    4. Append song record to Session DO                                 │
│    Ret:  { songId, songUrl, metadata, composition, durationSec }       │
│                                                                         │
│  POST /episode/:sessionId/finalize                                     │
│  GET  /episode/:episodeId                                              │
│  GET  /geocode?lat&lon   (proxied Nominatim, KV-cached)                │
│  GET  /nearby?lat&lon    (proxied Overpass,  KV-cached)                │
│  GET  /weather?lat&lon   (proxied Open-Meteo, KV-cached)               │
└────────────────────────────────────────────────────────────────────────┘
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

### State aggregator

Every 5 seconds, samples all sources and composes the current `StateVector`. Stored in a Zustand store; consumed by the prompt synthesizer and any UI that cares.

### Song synthesizer

The piece is structured as a **playlist of full songs** (each ~3–6 min, generated as one ElevenLabs Music call with a `composition_plan`), not a continuous stream of stitched clips. Each song is internally coherent; transitions happen only at song boundaries. The synthesizer's job is curating the playlist — deciding what *next song* should sound like given the recent few.

**At session start:** the cold-start prelude begins playing immediately (see *Cold-start prelude* below) and the synthesizer kicks off `/generate` for song 1 in parallel. The prelude's metadata is the sole entry in `recentHistory` for song 1.

**Steady state:** triggered when the currently-playing song has roughly `(measuredLatency + bufferWindow)` seconds remaining (see *Playback strategy*):

1. Snapshot the current state vector.
2. Gather active (non-decayed) stickers.
3. Pull the **last 3 songs' `{ songId, metadata, measuredFeatures }`** from the session store as `recentHistory`. `measuredFeatures` are DSP-derived from the rendered audio (BPM estimate, spectral centroid, RMS loudness) — what the song *actually* sounds like, not just what Claude described.
4. `POST /generate` with `{ sessionId, stateVector, stickers, recentHistory }`.
5. Stash the returned `metadata` and `measuredFeatures` (computed once playback begins) in the session store.
6. Hand the returned song to the audio engine, which queues it after the currently-playing one.

### Audio engine

- Web Audio API. Two `AudioBufferSourceNode`s, A and B (current + next).
- A plays. When A has ~30 seconds remaining (configurable; gives generation lead time), fetch and decode B.
- At A's natural end: optional brief 1–2 s gain ramp (or hard cut) to B. No long crossfade — songs are full, internally coherent compositions with intentional intros and outros, so seams aren't musically necessary to hide.
- Swap roles. Repeat indefinitely.
- Media Session API exposes "Hero Syndrome — Scene 1" on the lock screen with stop control.
- An `AnalyserNode` on the master bus drives the live waveform visualization *and* feeds the per-song DSP features (BPM, spectral centroid, loudness) into the session store for `recentHistory`.

### Sticker layer

- Sticker palette lives in a curated JSON list.
- Tap-to-add (MVP) places a sticker. Each sticker records `{ emoji, placedAt, decayAt = placedAt + 5min }`.
- The Zustand store exposes `activeStickers()` which filters by `now < decayAt`.
- On the next song-boundary `/generate` call, active stickers are included. A fresh sticker spike typically resolves to `transitionIntent: 'break'` on the next song so the user feels their input land.
- UI fades sticker opacity *and* size from 1 to 0 across its lifetime.

## Backend architecture

One Cloudflare Worker acts as the HTTP router. Per-session mutable state lives in a **Session Durable Object** (one DO instance per `sessionId`) — strongly consistent, single-threaded writes avoid the lost-write hazards of read-modify-write on KV. Episode records (immutable post-finalize) and upstream proxy caches live in KV. Audio blobs (songs + preludes) live in R2.

### `POST /generate`

```
Request:  { sessionId, stateVector, stickers, recentHistory }
  - recentHistory: the last 3 songs' { songId, metadata, measuredFeatures }
    sent by the client. The full per-song record (composition_plan,
    stateVector, stickers) lives server-side in the Session DO.
Steps:
  1. Router forwards the request to Session DO `idFromName(sessionId)`.
  2. DO checks rate limit (1 req / 10 s per session) using its own storage.
  3. Build the LLM system+user prompt (below); include recentHistory as
     continuity + curation context.
  4. Call Anthropic: model=claude-haiku-4-5, temperature=0.7, max_tokens=800,
     `tool_choice` forces a single tool call to `compose_song` whose
     input_schema is { metadata, composition }. Returns a parsed object,
     no JSON parsing layer.
  5. Call ElevenLabs Music with the `composition` (composition_plan +
     overall prompt). Target song length 3–6 min.
  6. Stream audio bytes from ElevenLabs straight into R2 at key
     `sessions/{sessionId}/songs/{songId}.mp3` — never buffer the full
     song in Worker memory.
  7. Append { songId, metadata, composition, stateVector, stickers,
     createdAt } to the session in DO storage.
  8. Return { songId, songUrl, metadata, composition, durationSec }.
Failure modes:
  - LLM fails:           fall back to a deterministic composition_plan
                         derived from the state vector via a rule table.
  - Tool call malformed: retry once; on second failure, use the rule-table
                         fallback.
  - Music fails:         retry once with the same composition; if still
                         failing, return a 503 carrying the nearest prelude
                         bucket so the client can fall back to a prelude.
```

### `POST /episode/:sessionId/finalize`

```
Request:  { title?, endedAt }
Steps:
  1. Router forwards to Session DO.
  2. DO loads its own session state.
  3. If no title, ask Claude (separate one-shot, ~30 tokens) to generate
     one from the signal/sticker/song timeline.
  4. Write `episodes/{episodeId}` to KV with a fresh opaque ULID.
  5. Copy/move song blobs from `sessions/{sessionId}/songs/*` to
     `episodes/{episodeId}/songs/*` so they survive the session R2
     lifecycle rule (see Deployment).
  6. Mark the DO finalized; DO storage gets a 7-day deletion alarm.
  7. Return { episodeId, shareUrl }.
```

### `GET /episode/:id`

Reads from KV (`episodes/{episodeId}`). Returns episode metadata (title, start/end, song list with timestamps + metadata + measuredFeatures, sticker events, sparse state-vector samples). Song URLs resolve through the Worker (`/episode/:id/song/:songId`) so we can control caching and never make the R2 bucket public.

### `GET /geocode?lat=&lon=`

Proxies Nominatim reverse geocoding (`zoom=18`, `addressdetails=1`). The Worker derives `placeType` from the response's primary `category` + `type` via the lookup table in *Derivations*, and returns the bundle:

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
};

type Sticker = {
  emoji: string;
  placedAt: string;
  decayAt: string;
  // effective intensity = 1 - (now - placedAt) / (decayAt - placedAt), clamped to [0, 1]
};

type SongMetadata = {
  bpmRange: [number, number];            // e.g. [60, 72]
  key: string;                            // "D minor" | "C mixolydian" | "modal/ambiguous"
  intensity: number;                      // 0..1
  instrumentation: string[];              // ["solo cello", "warm pads", "tape hiss"]
  genreTags: string[];                    // ["neo-classical", "drone", "ambient"]
  transitionIntent: 'continue' | 'evolve' | 'shift' | 'break';
  // continue = same vibe with slight variation
  // evolve   = related, moving forward thematically
  // shift    = intentional pivot to a new mood
  // break    = hard contrast (sticker spike or major state change)
};

// What ElevenLabs Music receives. The Worker passes `composition` verbatim
// as the API's `composition_plan` field.
type Composition = {
  overallPrompt: string;                  // top-level vibe description
  sections: Array<{                       // 1-30 sections, total 3s..10min,
    label: string;                        //   each section 3..120s
    durationSec: number;                  // 3..120
    prompt: string;                       // section-level prompt
  }>;
};

// DSP-derived from the rendered audio once playback begins. Feeds back
// into `recentHistory` so the next song is steered by what the previous
// songs *actually* sounded like, not just what Claude described.
type MeasuredFeatures = {
  bpmEstimate: number;                    // measured tempo
  spectralCentroidHz: number;             // brightness proxy
  rmsLoudness: number;                    // 0..1, perceptual energy
  durationSec: number;                    // actual rendered length
};

type SessionRecord = {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  songs: Array<{
    songId: string;
    startedAt: string;
    durationSec: number;
    metadata: SongMetadata;
    composition: Composition;
    measuredFeatures?: MeasuredFeatures; // populated by client after playback begins
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

Single-turn Claude Haiku call. Structured output is enforced via Anthropic
**tool use** (not JSON mode — Anthropic doesn't have one): we define a single
tool `compose_song` whose `input_schema` is the `{ metadata, composition }`
object below, and force the call with `tool_choice: { type: "tool", name:
"compose_song" }`. The tool's parsed input is the structured result; no
JSON-string parsing layer is needed.

```
System:
You are the music director for a film of this person's life. You program
the score one song at a time, reading the current state of the person's
world, any emoji "mood stickers" they've placed, and the recent few songs
already in the playlist. Each song is a complete piece (~3–6 min) composed
from a sequence of sections.

You must call the `compose_song` tool exactly once. Its input has two parts:

  metadata:    a label of the song's musical character (BPM range, key,
               intensity, instrumentation, genre tags, transitionIntent).
               This is for downstream continuity; ElevenLabs never sees it.

  composition: the structured plan sent verbatim to ElevenLabs Music as
               its composition_plan. Contains an overallPrompt and 1–30
               sections (each 3–120 s, summing to 3 s–10 min total). Each
               section has a label, durationSec, and a section-level prompt.
               Section prompts MUST explicitly embed the metadata values —
               state BPM (or narrow range), key/mode, lead instrumentation,
               and intensity descriptor in the prose. Metadata and section
               prompts must agree.

CURATION RULES (this is a playlist, not a stitched stream):
- Use `recentHistory` (last 3 songs' metadata + measuredFeatures) as your
  curation context. measuredFeatures is what the rendered audio actually
  sounded like — trust it more than metadata when they disagree.
- Each song must have its own character — do not repeat prior compositions
  or metadata values verbatim. Vary key, instrumentation, and structure.
- Pick `transitionIntent` based on how state and stickers have changed:
    continue — same vibe, slight variation (sustained context, no sticker)
    evolve   — related, moving forward thematically (gradual state drift)
    shift    — intentional pivot to a new mood (significant state change)
    break    — hard contrast (fresh sticker spike, or major state change
               like motionClass: still → running, or weather: clear → storm)
- Songs are full compositions: design intentional intros and outros so
  back-to-back playback feels like a curated set, not a hard cut.
- Instrumental only — no lyrics, no vocal lines.
- Prefer specific over abstract. Cinematic but never obvious. Avoid clichés.

User:
State: {state_vector_json}
Active stickers: {stickers_json}
Recent history (most recent last): {recent_history_json}
```

The returned `composition` is passed verbatim as `composition_plan` to the
ElevenLabs Music API. The full `{ metadata, composition, stateVector }` is
stored with every song; subsequent songs read `metadata` and
`measuredFeatures` from `recentHistory` as their curation context.

## Cold-start prelude

Even a full-song generation takes ~30–90 seconds; the first audio can't wait. Solution: **25 pre-generated short prelude tracks** (~30–60 s each, designed as opening pieces with low-energy outros), deterministically indexed by the initial state vector. The client picks one, plays it immediately, and `/generate` fires in parallel for song 1. The prelude hands off to song 1 with a brief 1–2 s gain ramp once song 1 is ready.

The prelude bank is also the runtime fallback for `/generate` failures — if the Worker returns 503, the client picks the nearest bucket prelude rather than going silent.

### Bucketing scheme

A 5×5 grid over the two signals reliably available at app start:

- **Time phase (5):** `early` (dawn + morning) · `day` (noon + afternoon) · `gold` (golden hour) · `dusk` (dusk + night) · `deep` (witching hour)
- **Intensity quintile (5):** `dormant` [0.0–0.2) · `still` [0.2–0.4) · `gentle` [0.4–0.6) · `active` [0.6–0.8) · `intense` [0.8–1.0]

If `movement.intensityNormalized` hasn't stabilized within ~2 seconds of Start, default to the `still` quintile. Bucketing is a pure function of the state vector — same inputs always return the same prelude.

Weather and location are intentionally excluded: they often haven't loaded at session start, and the prelude only needs to be *plausibly* right. Song 1 adapts to the full state vector.

### Manifest

Served as a static `preludes/manifest.json` from R2 (CDN-cached). The full audio files are also cached by the client service worker on first app open so cold-start is sub-3s on flaky networks (~25 × 1 MB ≈ 25 MB cache budget — comfortably within PWA norms):

```typescript
type PreludeManifest = {
  version: string;
  preludes: Array<{
    id: string;                         // e.g. "gold_gentle"
    timePhase: 'early' | 'day' | 'gold' | 'dusk' | 'deep';
    intensity: 'dormant' | 'still' | 'gentle' | 'active' | 'intense';
    audioUrl: string;                   // R2 URL (proxied through Worker)
    durationSec: number;
    composition: Composition;           // composition used to generate
    metadata: SongMetadata;             // same schema as live songs
  }>;
};
```

### Client flow at session start

1. User taps **Start scene**.
2. Client reads `preludes/manifest.json` (warm-cached after first app open).
3. Client computes bucket key from current state vector → selects prelude entry.
4. Fetch `audioUrl` (service-worker-cached), decode, begin playback immediately.
5. In parallel, `POST /generate` for song 1 with `recentHistory = [{ ...preludeMetadata }]` so song 1 evolves from the prelude's musical character.
6. Brief gain ramp swap to song 1 when ready.
7. From song 1 onward, normal playlist flow.

If song 1 is late, the prelude tail-loops under a low-pass filter, **capped at 10 s**. If song 1 is still not ready after the cap, the client picks a *second* prelude from a neighboring bucket and chains that, rather than glitching audibly on indefinite loops.

### Offline generation

Preludes are produced by a one-shot CLI (`apps/prelude-gen`) that:

1. Iterates 25 canonical state vectors (time phase × intensity quintile, with representative weather and a neutral location).
2. Runs each through the same LLM + ElevenLabs pipeline used by `/generate`, with empty `recentHistory`. The composition_plan is constrained to a single 30–60 s section so preludes stay short.
3. Uploads `preludes/{id}.mp3` and writes `preludes/manifest.json` to R2.

Run on demand — after prompt-template changes or to rotate aesthetics. Not part of the runtime path.

## Session lifecycle

A **session** is one continuous listening experience — a playlist of generated songs played back-to-back, may span tens of minutes to hours. A finalized session becomes an **episode**: a shareable, frozen recording of what was played.

### Starting a session

1. User taps **Start scene**.
2. Client generates a fresh `sessionId` as a ULID. No server round-trip — the ID is local.
3. Client kicks off the cold-start prelude (see above) and `POST /generate` for song 1 in parallel.
4. The first `/generate` call instantiates the Session Durable Object lazily (`idFromName(sessionId)`). There is no explicit "create session" endpoint.

### While the session is running

- `sessionId` lives in the Zustand store (in-memory only).
- Every `/generate` call routes through the Worker to the same Session DO, which appends a song record to its own storage. DO storage is strongly consistent — concurrent appends serialize correctly, no lost-write hazards.
- **Rate limit:** `POST /generate` is capped at 1 request per 10 seconds per `sessionId`, enforced inside the DO using its own storage (no separate Cloudflare rate-limit binding needed). Guards against client-side runaway loops; normal song-boundary generation fires ~once per 3–6 min.

### Ending a session

Three ways a session ends, in priority order:

1. **Explicit.** User taps **End scene**. Client fades audio out, calls `POST /episode/:sessionId/finalize`, navigates to the returned `shareUrl`.
2. **Idle timeout.** If the PWA is backgrounded or the tab is hidden for >30 minutes, the client auto-finalizes on next visibility restoration. The next Start tap begins a fresh session.
3. **Abrupt close.** If the tab/app is killed without warning, no finalize fires. The Session DO persists un-finalized; a 7-day DO storage alarm cleans it up.

### Housekeeping

- **DO storage:** un-finalized sessions deleted by a 7-day alarm set on first write. Finalized DOs are deleted immediately after the episode is written to KV (the data has been migrated).
- **Episodes (KV):** no TTL.
- **Resumption:** out of scope for MVP — each Start tap always yields a new session. Persisting an in-progress session across reloads could be added later via `sessionStorage`, but isn't needed for the art piece's use case.

## Playback strategy

- **Target song length:** 3–6 minutes (composition_plan total duration). The LLM picks within range based on state — sustained calm states get longer, denser compositions; volatile states get shorter, punchier ones.
- **Inter-song transition:** brief 1–2 s gain ramp at song boundary (or hard cut if outro/intro design supports it). No long crossfade — songs are internally complete.
- **Generation lead time:** kick off song N+1 at `T-minus-(measuredLatencyP95 + safetyBuffer)` where `safetyBuffer` is ~30 s. Measure rolling latency per session; adapt. With 3+ minute songs this gives huge headroom even if generation takes 60–90 s.
- **Late next song:** extend A via a short tail-loop on a low-pass filter, **capped at 10 s**. If still not ready, fall back to a prelude bank entry chosen from the current state vector's bucket, rather than glitching on indefinite loops.
- **Failed generation:** retry once with the prior composition; if still failing, fall back to a prelude bank entry and surface a small UI hint.

## Privacy

- Location and motion stay on device where possible. The backend sees the aggregated `StateVector` (with place labels, not raw coords) — except for `/geocode`, `/nearby`, and `/weather` calls, which must proxy raw lat/lon.
- Session and episode IDs are random ULIDs. No personal identifiers anywhere.
- Episode URLs are unguessable; no auth required to share or access.
- API keys (ElevenLabs, Anthropic) are held only on the Worker.
- Rate-limit `/generate` per `sessionId` to prevent runaway loops.

## Deployment

- **Frontend:** Cloudflare Pages (HTTPS required for PWA + sensors).
- **Backend:** one Cloudflare Worker (HTTP router) + Session Durable Object class + R2 bucket + KV namespace, single project.
- **R2 lifecycle:** lifecycle rule on the `sessions/` prefix expires audio after 7 days. Episode audio is moved to `episodes/` at finalize time and is exempt. Periodic Cron Trigger reconciles orphans (R2 objects whose Session DO no longer exists).
- **Service worker caching:** prelude `.mp3` files are pre-fetched on first app open (background, low priority) so cold-start works on flaky networks. Generated song audio, served via the Worker, is cached cache-first with long TTL — songs are immutable per `songId`.
- **CDN:** `preludes/manifest.json` and prelude audio are served from R2 through the Worker with long-TTL `Cache-Control` headers; Cloudflare's edge cache fronts them globally.
- **Repo layout:**

```
hero-syndrome/
├─ apps/web/           # Vite React PWA
├─ apps/worker/        # Cloudflare Worker (router) + Session DO
├─ apps/prelude-gen/   # one-shot CLI that generates the prelude bank
├─ packages/shared/    # StateVector, Sticker, SongMetadata, Composition, API types
├─ packages/llm/       # shared LLM + ElevenLabs call modules used by Worker + prelude-gen
└─ docs/               # concept.md, architecture.md, mvp-plan.md
```

## Observational analytics

User-level analytics are out (per the art-piece framing — no accounts, no retention metrics, no funnels). Operational observability is in: we need to know what the system is doing in order to iterate on the prompt template, the prelude bank, and the latency budget.

- **Worker logs:** Cloudflare Workers Logpush (or `wrangler tail` during dev) for every request. Structured JSON: `{ ts, sessionId, route, status, latencyMs, llmLatencyMs, musicLatencyMs, llmTokensIn, llmTokensOut, songDurationSec, transitionIntent, errCategory? }`.
- **Per-session debug log:** the Session DO accumulates a compact event log (`{ event, ts, payload }`) and exposes it at `GET /debug/session/:sessionId` (gated by a shared dev token). Lets the team replay decisions for any session by ID without touching production-routed logs.
- **Prelude bucket distribution:** counter in KV per bucket id, incremented at every prelude selection. Tells us which buckets actually serve traffic so we know where to invest in fresh generations.
- **No client-side analytics SDK.** No Sentry, no PostHog, no GA. Errors that matter surface through Worker logs (the Worker is the only place an error can plausibly affect another user). Client-side uncaught exceptions are accepted as part of the art piece's tolerance.
- **No PII in any log.** `sessionId` is opaque; no IPs, no user agents beyond what Cloudflare logs by default.

## Open technical questions

1. **ElevenLabs Music latency & song length.** Needs empirical measurement for full songs (not 30s clips) generated via `composition_plan`. If a 4-min song reliably generates in <90 s, the lead-time math has huge headroom; if it's 3–5 min, we may need to keep N+2 also generated or to shorten target song length.
2. **Waveform visualization source.** Analyzer node on the master bus (literal audio waveform) vs. a stylized signal-driven animation that *looks* like a waveform but is really driven by state. Design call.
3. **iOS Safari audio session.** Playback must start from a user gesture (the Start button handles this). Mute-switch behavior, Media Session control coverage, and screen-locked playback inside a home-screen-installed PWA need verification on-device early — if screen-lock kills audio, the experience design changes.
4. **Geolocation battery cost.** `watchPosition` with high accuracy is expensive. Default to low-accuracy + longer intervals; only bump accuracy if the session is long or movement is high.
5. **Does ElevenLabs honor `composition_plan` structure and numeric musical terminology?** The design assumes the API respects section boundaries, durations, and embedded BPM/key terms in section prompts. If section structure is loose, we may need to compose songs as a single section with a long combined prompt; if numeric terms are loose, shift to descriptive tempo words + narrow ranges. Measure during the first end-to-end spike.
6. **OSM usage rules.** Nominatim AND Overpass have strict usage policies. The `/geocode` and `/nearby` proxies must cache aggressively (already in the design) and identify themselves per the TOS. Need a commercial fallback (Mapbox, Stadia Maps?) if we share this more broadly than a demo.
7. **Motion classifier thresholds.** The numbers in *Derivations* are placeholders. Collect real traces during the spike — particularly for `walking` vs `still` on a phone held loosely vs. in a pocket, and `vehicle` false-positives on fast escalators / trains.
8. **Prelude bucketing scheme.** The 5×5 time-phase × intensity-quintile grid is a starting point. Production telemetry will show which buckets most cold starts fall into; we may want to weight slots unevenly, expand to 50, or introduce a secondary axis (weather?) once we have data.
9. **ElevenLabs cost beyond free credits.** Free credits cover MVP. A long-running demo at meaningful scale will exceed them. Need to understand the per-song cost curve and either budget for it, switch to a self-hosted model (MusicGen), or pivot to a stem-based hybrid where most audio is pre-generated and live composition is reduced to mixing.

## Later features

Out of MVP, but designed to slot into the existing architecture without rework.

### Microphone

Two distinct uses, one permission:

- **Ambient sound sensing.** Process a short mic sample on-device every ~30 s — derive loudness, voice-activity flag, and dominant frequency band. Ship the *summary stats only* in `StateVector.audio`, never raw audio. Distinguishes "noisy bar" from "quiet bedroom" — currently invisible to the system. Caveat: phone in pocket muffles the signal into noise; the feature is most useful when the phone is in hand or on a surface. Worth gating by `motionClass` so we don't trust pocketed-mic readings.
- **Verbal scene direction.** A "speak to the score" affordance — user holds a button, says "make it more urgent" or "less drums," release. The clip is transcribed (Whisper or similar, on-device if feasible, server-side fallback) and the transcript becomes a high-priority sticker-equivalent intent token in the next `/generate`. Decays after one song unless repeated. Replaces emoji stickers with words for users who prefer language; stickers stay as the low-friction default.

Both flow through one mic permission ask, framed earnestly ("speak to the score, or let the room's sound shape it").

### Camera

User taps a "what does it look like here" affordance, captures one frame. The frame stays on-device; we extract:

- A 3-color dominant palette (warm sodium / cool fluorescent / forest green / etc.).
- A coarse scene tag from an on-device image classifier (tiny MobileNet variant, ~5 MB) — `indoor/outdoor`, `nature/built`, `crowded/empty`.

Both ship in `StateVector.visual`, never the image itself. Becomes a one-shot input that influences the next 1–2 songs and decays. Cost: on-device classifier + an extra optional permission, no recurring overhead.

### Why these are deferred

Both microphone and camera require permission flows that could discourage first-time users on what's meant to be a low-friction art piece. They also depend on the phone being held / out of pocket for the signal to be useful. Ship MVP with the passive sensors (clock/motion/weather/location/stickers), validate the experience, then add these as opt-in enrichments.
