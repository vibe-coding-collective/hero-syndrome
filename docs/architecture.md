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
│  POST /generate    { stateVector, stickers, sessionId }              │
│    1. Build LLM prompt → Claude Haiku → music prompt                 │
│    2. ElevenLabs Music → audio clip                                  │
│    3. Store clip in R2                                               │
│    4. Append clip record to session in KV                            │
│    5. Return { clipId, clipUrl, prompt, durationSec }                │
│                                                                       │
│  POST /episode/:sessionId/finalize                                   │
│  GET  /episode/:episodeId                                            │
│  GET  /geocode?lat&lon   (proxied Nominatim, KV-cached)              │
│  GET  /weather?lat&lon   (proxied Open-Meteo, KV-cached)             │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ElevenLabs  │  Anthropic  │  Open-Meteo  │  Nominatim
```

## Client architecture

### Sensor modules

Each sensor is a small module exposing a subscribe API.

- **`geolocation.ts`** — `navigator.geolocation.watchPosition()` with low-accuracy mode for battery. Emits `{ lat, lon, speedMps, heading }`.
- **`motion.ts`** — `DeviceMotionEvent` at ~10 Hz. Rolling-window RMS gives `intensityNormalized`. A small classifier maps the intensity + pattern to a `motionClass` (`still`, `walking`, `running`, `vehicle`).
- **`clock.ts`** — pure-function derivation of `phase` and `dayOfWeek` from `Date.now()` + lat/lon (for sunrise/sunset).

### Derived signals

- **`reverseGeocode.ts`** — calls backend `/geocode` proxy. Client-side cache keyed by rounded lat/lon (~3 decimal places). Extracts `placeType` from OSM tags.
- **`weather.ts`** — calls backend `/weather` proxy. Refreshes every ~10 minutes or on significant location change.

### State aggregator

Every 5 seconds, samples all sources and composes the current `StateVector`. Stored in a Zustand store; consumed by the prompt synthesizer and any UI that cares.

### Prompt synthesizer

Triggered when the currently-playing clip has ~5 seconds remaining:

1. Snapshot the current state vector.
2. Gather active (non-decayed) stickers.
3. Pull the last 2–3 clips' metadata from the session store as `recentHistory`.
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
  - recentHistory: array of the last 2–3 clips' { metadata, stateVectorSummary }
    sent by the client; full records live server-side in the session.
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

### `GET /geocode?lat=&lon=`

Proxies Nominatim. KV cache keyed by `geo:{roundedLat}:{roundedLon}`, 30-day TTL.

### `GET /weather?lat=&lon=`

Proxies Open-Meteo. KV cache keyed by `wx:{roundedLat}:{roundedLon}`, 10-minute TTL.

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
    condition: string;                  // mapped WMO code, e.g. 'drizzle'
    sunriseProximityMin: number;        // negative = before sunrise
    sunsetProximityMin: number;
  };
  location?: {
    speedMps: number;
    motionClass: 'still' | 'walking' | 'running' | 'vehicle';
    placeType: string;                  // 'park' | 'urban' | 'residential' | 'coast' | ...
    neighborhood?: string;
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

## Playback strategy

- **Target clip length:** 30–45 seconds. Balances generation latency against adaptation rate.
- **Crossfade:** 3–4 seconds.
- **Generation lead time:** kick off clip N+1 at `T-minus-(measuredLatency + crossfadeWindow)`. Measure rolling latency per session; adapt.
- **Late next clip:** extend A via a short tail-loop on a low-pass filter rather than going silent.
- **Failed generation:** retry once with the prior prompt; if still failing, surface a small UI hint and continue A.

## Privacy

- Location and motion stay on device where possible. The backend sees the aggregated `StateVector` (with place-type label, not raw coords) — except for `/geocode` and `/weather` calls, which must proxy raw lat/lon.
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
6. **Reverse geocoding fallback.** Nominatim has strict usage rules. Need a fallback (Mapbox free tier?) if we ever share this more broadly than a demo.
