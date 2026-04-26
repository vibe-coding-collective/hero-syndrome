# Hero Syndrome — MVP Build Plan

Companion to `concept.md` and `architecture.md`. Read those first; this doc layers MVP cuts, ordering, and concrete setup steps on top.

## Goal

Ship a playable end-to-end version of the art piece on iOS Safari and Android Chrome. The user can tap **Start scene**, hear an adaptive playlist of full-length songs that respond to time / motion / weather / location / their stickers, and end the scene to get a shareable episode URL that replays the same songs in order.

## Scope decisions

### IN

- Four signal sources: **clock, motion, weather, location**.
- **Stickers** as the user agency layer (tap-to-add, decaying; 5-min lifetime).
- **Playlist of full songs** generated via ElevenLabs Music `composition_plan` (3–6 min each, queued back-to-back, brief 1–2 s gain ramp at boundaries — no long crossfade).
- **Cold-start prelude bank** of 25 pre-generated short opener tracks (~30–60 s), bucketed by time-phase × intensity quintile, also reused as the runtime fallback when `/generate` fails.
- **Episode finalize + replay**: song list + sticker events + LLM-generated title, played back client-side at an opaque shareable URL.
- **iOS + Android** mobile web (PWA installable, but works in plain browser too).
- **Cloudflare** Worker + Session Durable Object + R2 + KV + Pages. Single account, single project.
- **Anthropic tool use** (not JSON mode) for structured `compose_song` output.
- **Operational observability** — Worker request logs + per-session debug log retrievable by `sessionId`.
- **Quirky aesthetic** — first-pass visual identity, swap-able later.

### OUT (explicit cuts)

- **No astrology.** No onboarding modal, no birth-data fields, no transit signals. (Cut for cross-cultural reasons — the app should be universal.)
- **No microphone, no camera.** Both designed to slot in later (see *Later features*); deferred for first ship to avoid extra permission prompts and to validate the passive-sensor experience first.
- **No server-side stitched audio.** The episode page replays the song list in order. No ffmpeg, no concatenation step, no exported `.mp3` per episode.
- **No drag-drop stickers.** Tap-to-add only — drag-drop on iOS PWA is fiddly enough to defer.
- **No accounts, auth, user profiles, user-level analytics.** Operational logs are in (above); no funnels, no retention metrics, no behavioral tracking.
- **No session resumption** across reloads. Each Start tap = a new session.
- **No replay-with-variation, no highlight reel, no streaks.**
- **No desktop-specific work.** Desktop Chrome is fine for dev iteration but not a target.

### Confirmed architectural assumptions

- Web Audio API two-buffer playlist queue (current + next song); brief 1–2 s gain ramp at song boundary, no long crossfade.
- Target song length: 3–6 minutes (composition_plan total duration; 1–30 sections, each 3–120 s).
- Generation rate-limit: 1 `/generate` per 10 s per `sessionId`, enforced inside the Session Durable Object.
- Per-session state lives in a Session Durable Object (one DO instance per sessionId). Episodes (immutable post-finalize) live in KV. Audio in R2.
- R2 lifecycle: `sessions/` prefix expires after 7 days; `episodes/` is exempt (audio is moved at finalize).
- Idle timeout: 30 min hidden → auto-finalize on next visibility.
- All API keys (ElevenLabs, Anthropic) live only on the Worker.

## Repo layout

Monorepo with pnpm workspaces (smaller lockfiles + faster installs than npm; Cloudflare tooling supports both).

```
hero-syndrome/
├─ apps/
│  ├─ web/              # Vite + React + TS PWA
│  ├─ worker/           # Cloudflare Worker router + Session Durable Object
│  └─ prelude-gen/      # CLI, runs once per aesthetic refresh
├─ packages/
│  ├─ shared/           # StateVector, Sticker, SongMetadata, Composition, API types
│  └─ llm/              # Anthropic + ElevenLabs call modules; imported by Worker + prelude-gen
├─ docs/                # concept.md, architecture.md, mvp-plan.md
├─ package.json
├─ pnpm-workspace.yaml
└─ README.md
```

`packages/shared` exists so the Worker and the web app can import the same `StateVector` / `SongMetadata` / `Composition` types — drift between client and server schemas is a real pain otherwise. `packages/llm` exists so `apps/worker` (for `/generate`) and `apps/prelude-gen` (for batch generating preludes) call the same Anthropic and ElevenLabs code.

---

## Build

The whole thing gets built in one pass. Five buildable units below — implement in any order, mock dependencies as needed. Validation tasks (ElevenLabs latency, iOS audio, motion classifier tuning) fold into the relevant unit instead of being gated behind a separate spike.

### Foundations

- `pnpm init -w` at root; `pnpm-workspace.yaml` lists `apps/*` and `packages/*`.
- `apps/web` scaffolded from Vite React-TS template. Add Tailwind, Zustand, `vite-plugin-pwa`, `react-router-dom`.
- `apps/worker` scaffolded with `wrangler init`. `wrangler.toml` declares R2 bucket + KV namespace + Durable Object class bindings (see *Cloudflare setup* below).
- `apps/prelude-gen` is a tiny Node CLI — no framework, just `tsx` + `packages/llm`.
- `packages/shared` exports all types from `architecture.md`.
- `packages/llm` wraps the Anthropic tool-use call (`compose_song` tool) and the ElevenLabs Music call (`composition_plan`), with rule-table fallbacks. Imported by both `apps/worker/src/generate.ts` and `apps/prelude-gen`.
- Vite dev proxy: `/api/*` → `http://localhost:8787` so `wrangler dev` and `vite dev` cooperate.
- `.dev.vars` in `apps/worker` for local secrets (gitignored).

### `packages/shared`

Type-only package, no runtime code. Lift the following types verbatim from `architecture.md`:

- `StateVector`
- `Sticker`
- `SongMetadata`, `Composition`, `MeasuredFeatures`
- `SessionRecord`, `EpisodeRecord`
- API request/response shapes for every Worker endpoint (`GenerateReq`, `GenerateRes`, `WeatherRes`, `GeocodeRes`, `NearbyRes`, `EpisodeRes`, `FinalizeReq`, `FinalizeRes`)
- `PreludeManifest`

### `apps/worker` — Cloudflare Worker + Session Durable Object

The Worker is a thin HTTP router that forwards session-scoped requests to a Session Durable Object (one DO instance per `sessionId`). DO storage is strongly consistent — concurrent appends serialize correctly, no lost-write hazards. Stateless endpoints (upstream proxies, episode reads) run directly in the Worker. Audio in R2; episode index in KV; per-session mutable state in DO storage.

#### Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/generate` | Routed to Session DO. LLM (tool use) → ElevenLabs (composition_plan) → R2 → DO append. Rate-limited 1 req / 10 s per `sessionId` inside the DO. |
| `POST` | `/episode/:sessionId/finalize` | Routed to Session DO. Title-generates via Claude, writes `episodes/{episodeId}` to KV with fresh ULID, copies song audio from `sessions/` to `episodes/` prefix in R2, deletes the DO. |
| `GET` | `/episode/:id` | Reads episode JSON from KV (title, song list with timestamps + metadata + measuredFeatures, sticker events, sparse state-vector samples). |
| `GET` | `/episode/:id/song/:songId` | Streams song audio from `episodes/{id}/songs/{songId}.mp3` in R2 with long-lived `Cache-Control`. |
| `GET` | `/song/:sessionId/:songId` | Streams in-flight session song from `sessions/{sessionId}/songs/{songId}.mp3` in R2. |
| `GET` | `/preludes/manifest.json` and `/preludes/:id.mp3` | Served from R2 with long-TTL caching. |
| `GET` | `/weather?lat&lon` | Open-Meteo proxy. WMO → `condition` mapping; sunrise/sunset proximity computed. KV cache 10 min. |
| `GET` | `/geocode?lat&lon` | Nominatim reverse-geocode proxy. Returns derived `{ placeType, place, road, neighborhood, city }`. KV cache 30 days. |
| `GET` | `/nearby?lat&lon` | Overpass proxy (`around:150`, top ~3 ranked POIs). KV cache 30 days. |
| `GET` | `/debug/session/:sessionId` | Dev-token-gated. Returns the DO's per-session debug event log. |
| `OPTIONS` | `*` | CORS preflight for `localhost:5173` and the production Pages origin. |

#### Modules

- `src/index.ts` — router, CORS, dispatch to Session DO for session-scoped routes.
- `src/sessionDO.ts` — Session Durable Object class. Owns rate limiting, song-record append, debug log, finalize flow, 7-day cleanup alarm.
- `src/generate.ts` — pure module called from inside the DO. Composes LLM + Music, streams to R2, returns the song record to append.
- `src/episode.ts` — finalize + read helpers.
- `src/r2.ts` — R2 streaming proxy + move-on-finalize helper (`sessions/` → `episodes/`).
- `src/weather.ts`, `src/geocode.ts`, `src/nearby.ts` — upstream proxies, all cache-first.
- `src/title.ts` — episode title prompt (separate one-shot, ~30 tokens).
- `src/kv.ts` — `writeEpisode`, `readEpisode`, cache helpers for upstream proxies.
- `src/derivations/placeType.ts` — OSM-tag → `placeType` lookup table.
- `src/derivations/wmoCondition.ts` — WMO weather code → `condition` mapping.

The actual Anthropic and ElevenLabs calls live in `packages/llm` so `apps/prelude-gen` shares them. Anthropic call uses **tool use** with a forced `compose_song` tool whose `input_schema` is `{ metadata, composition }`. Settings: `claude-haiku-4-5`, `temperature: 0.7`, `max_tokens: 800`. Single retry on tool-call validation failure; deterministic rule-table fallback for hard failures. ElevenLabs call streams the response body directly to R2 (don't buffer ~5 MB songs in Worker memory). Single retry on transient failure; 503 to client otherwise (client falls back to a prelude).

#### Cross-cutting

- All upstream calls send `User-Agent: HeroSyndrome/0.1 (contact: danporder@gmail.com)` (Nominatim + Overpass usage rules require identification).
- Session DO sets a 7-day storage alarm on first write (cleared at finalize, when the DO is deleted outright).
- R2 lifecycle rule: `sessions/` prefix expires after 7 days. `episodes/` prefix exempt. Periodic Cron Trigger reconciles orphans.
- Rate-limiting lives inside the DO (its own storage), not as a separate Cloudflare binding.
- LLM tool schema + system prompt lifted verbatim from `architecture.md`.
- **Observability:** every Worker request emits a structured JSON log line (`{ ts, sessionId, route, status, latencyMs, llmLatencyMs, musicLatencyMs, tokensIn, tokensOut, songDurationSec, transitionIntent, errCategory? }`). Cloudflare Workers Logpush ships these to a sink we can query. The DO maintains a compact per-session debug log retrievable at `/debug/session/:sessionId`.

### `apps/web` — React PWA

#### Sensors (`src/sensors/`)

- **`clock.ts`** — pure function. `phase`, `dayOfWeek`, `hour`, sunrise/sunset proximity (uses lat/lon if available; omits sun-relative phases otherwise). No network, no permissions.
- **`motion.ts`** — `DeviceMotionEvent` at ~10 Hz. Rolling 4 s window. Computes `intensityNormalized`, `motionClass`, and `pattern` per the classifier in `architecture.md`. Sticky filter (2 consecutive windows must agree before switching class). iOS requires `DeviceMotionEvent.requestPermission()` from a user gesture — wire into the Start tap. **Validation:** walk around with a real phone, log raw traces, tune the threshold constants before declaring this done.
- **`geolocation.ts`** — `navigator.geolocation.watchPosition()` low-accuracy. Emits `{ lat, lon, speedMps, heading }`.
- **`weather.ts`** — calls `/api/weather`. Refreshes on significant location change (>50 m) or every 10 min.
- **`reverseGeocode.ts`** — calls `/api/geocode?lat&lon`. Client-side cache keyed by rounded lat/lon (~3 decimal places).
- **`nearby.ts`** — calls `/api/nearby`. Refreshes only on significant location change (>50 m) — Overpass is rate-limited.

#### State (`src/`)

- **`store.ts`** — Zustand. Slices: `session` (id, startedAt, songs, stickers, stickerEvents), `playback` (isPlaying, currentSongId, latencyEMA), `sensors` (latest StateVector), `episode` (id, title for the Episode page).
- **`stateAggregator.ts`** — every 5 s, snapshots all sensors and writes a fresh `StateVector` to the store.
- **`songSynthesizer.ts`** — fires when the currently-playing song has ~`(measuredLatencyP95 + 30s)` remaining. Snapshots state vector, gathers active stickers, pulls **last 3 songs' `{ songId, metadata, measuredFeatures }`** from the store as `recentHistory`, calls `/api/generate`, stashes the response, hands the song to the audio engine.
- **`audioFeatures.ts`** — DSP module that runs on the playing song's AnalyserNode output: BPM estimate (autocorrelation peak on the onset envelope), spectral centroid, rolling RMS. Result written into the current song's `measuredFeatures` once stable (~10 s into playback).

#### Audio (`src/audio/`)

- **`engine.ts`** — Web Audio. Two `AudioBufferSourceNode`s for current + next song. Public API: `start(initialSongUrl)`, `enqueue(nextSongUrl)`, `stop()`. At song end, brief 1–2 s gain ramp (or hard cut) to the queued song — songs are full compositions with intentional intros/outros, so seams are musical, not technical.
- **Late-next-song fallback:** tail-loop the last 3 s of the current song under a low-pass filter, **capped at 10 s**. If the next song is still not ready after the cap, the engine asks the prelude bank for a bucket-matched fallback rather than glitching audibly on indefinite loops.
- **`analyser.ts`** — `AnalyserNode` on the master bus, `getFrequencyData` exposed for visualization, raw samples exposed to `audioFeatures.ts`.
- **`mediaSession.ts`** — exposes "Hero Syndrome — Scene N" on the lock screen with a stop control. **Validation:** verify on a real iPhone (home-screen-installed PWA) — does playback survive lock-screen, does the Media Session metadata appear, does the mute switch behave?

#### Stickers (`src/stickers/`)

- **`palette.ts`** — curated 16-emoji list. First pass: 🔥 🌧️ 👁️ 💀 🌀 🌙 ✨ 🩸 🪞 🕯️ 🐍 ⚡️ 🌹 🩻 🫧 🗝️. Riff freely.
- **`store.ts`** — `addSticker(emoji)` adds `{ emoji, placedAt, decayAt = placedAt + 5min }`; `activeStickers()` filters by `now < decayAt`.
- **`StickerPalette.tsx`** — bottom strip, tap-to-add, `navigator.vibrate(5)` haptic on tap, scale-pulse animation.
- **`StickerOverlay.tsx`** — wobbly emoji floating over the visualization. Opacity *and* size both decay over the 5 min lifetime.

#### Session lifecycle (`src/session/`)

- **`start.ts`** — generates client-side ULID, fetches `preludes/manifest.json` (warm-cached after first open), computes bucket key from current `StateVector` (5 time-phases × 5 intensity quintiles), fetches + decodes the prelude track (service-worker-cached after first app open), begins playback. In parallel, fires `/api/generate` for song 1 with `recentHistory = [preludeMetadata]`. Brief gain ramp swap to song 1 when ready.
- **`idle.ts`** — Page Visibility listener. If hidden > 30 min, auto-finalizes on next visibility restoration.
- **`end.ts`** — fades audio over ~2 s, calls `POST /api/episode/:sessionId/finalize`, navigates to returned `shareUrl`.

#### Pages (`src/pages/`)

- **`Home.tsx`** — Start button + permission-explainer card. Permission card runs once, explains why we want motion + location, then triggers `DeviceMotionEvent.requestPermission()` and `navigator.geolocation.getCurrentPosition()`. Denials degrade gracefully — never block playback.
- **`Scene.tsx`** — visualization centerpiece, sticker palette docked at bottom, End button unobtrusive.
- **`Episode.tsx`** — fetches `/api/episode/:id`, renders title + minimal timeline strip (sticker dots + place-type changes + weather changes + song boundaries). Big Play button — runs the audio engine on the saved song URL list in order. No `/generate` calls. "Copy link" / Web Share button.

#### API client (`src/api/client.ts`)

Typed fetch wrappers for every Worker endpoint, returning the shapes from `packages/shared`.

#### Visualization (`src/ui/Visualization.tsx`)

Not a literal oscilloscope. Generative organic blob (or drifting particles, or slow halo) driven by a *blend* of analyser frequency data and state-vector values. `placeType` + time `phase` set the color palette; `intensityNormalized` drives velocity; `pattern` shapes the deformation. Pause the rAF loop when `document.hidden` to save battery during locked-screen playback. See *Aesthetic direction* below.

#### PWA shell

- `public/manifest.json`, icons at 192 / 512 / maskable / Apple touch sizes.
- `index.html` with iOS-specific meta tags (`apple-mobile-web-app-capable`, status-bar style, splash screen links).
- `vite-plugin-pwa` configured with: cache-first long-TTL for the static shell, the prelude manifest, **and the prelude `.mp3` files** (background-prefetched on first app open — ~25 × 1 MB ≈ 25 MB cache budget); cache-first for generated song URLs (immutable per `songId`); network-first for everything else.

### `apps/prelude-gen` — CLI

One-shot generator for the cold-start bank. Run on demand after prompt-template changes or to rotate aesthetics. Not on the runtime path.

- **`src/buckets.ts`** — 25 canonical state vectors (5 time-phases × 5 intensity quintiles, neutral weather, neutral location, no stickers).
- **`src/index.ts`** — for each bucket: call `packages/llm` with empty `recentHistory` and a constraint that the composition_plan has a single 30–60 s section (preludes are short opener tracks, not full songs); call ElevenLabs; upload `preludes/{id}.mp3` to R2 with `Cache-Control: public, max-age=86400, immutable`. Build `preludes/manifest.json` (with a `version` field for future rotations) and upload it to R2.
- **Run once.** Listen to all 25 preludes. Regenerate any that feel wrong before declaring the bank done.

### Episode title prompt

Separate one-shot Claude call inside `/episode/:sessionId/finalize`:

```
You are titling an episode of someone's life.
Read the timeline of signal changes, stickers, and song characters below
and produce a single title:
- 4–10 words
- evocative, slightly off-kilter
- no quotes, no period at the end
Return only the title.

Timeline: {timeline_json}
```

### Cross-cutting behaviors

- **Permission UX:** single explainer card on first Start. Triggers motion + geolocation prompts from a user gesture. Denials degrade silently — clock + weather + location alone (or just clock) is still a usable signal set.
- **API keys** live only on the Worker. Never expose them to the client.
- **CORS** allow-list: `http://localhost:5173` + production Pages origin only.
- **User-Agent** identification on every Nominatim + Overpass call (TOS).
- **Observability:** structured Worker logs go to Cloudflare Workers Logpush; per-session debug log retrievable at `/api/debug/session/:sessionId` (dev-token-gated). No client-side analytics SDK.
- **Validation as you build** — for the empirical assumptions in `architecture.md` most likely to break (in priority order):
  - **iOS Safari Web Audio in a home-screen-installed PWA, screen-locked** — test on a real device on day 2, *before* most of the app is built. If screen-locked playback is broken, the experience design changes (it becomes screen-on-in-hand, not pocket-companion). Workaround if playback dies on lock: a parallel silent `<audio>` element acting as audio-session anchor.
  - **ElevenLabs `composition_plan` honoring section structure + numeric musical terminology** — measure during the first end-to-end `/generate` spike. If section boundaries are loose, fall back to single-section compositions with long combined prompts. If numeric terms are loose, shift to descriptive tempo words + narrow ranges. The tool-call contract on the Claude side stays the same either way.
  - **Motion classifier thresholds** — tune on real walks before declaring `motion.ts` done. The numbers in `architecture.md` are placeholders.

---

## Cloudflare setup walkthrough

You already have ElevenLabs and Anthropic keys. Cloudflare needs to be set up from scratch. This is roughly 30–45 minutes of clicking and CLI work the first time.

### 1. Create the account

1. Sign up at [cloudflare.com](https://cloudflare.com) with your email. Free tier is enough for everything below.
2. Skip the "add a domain" step for now — you can deploy without one.

### 2. Install Wrangler locally

```bash
pnpm add -D -w wrangler          # workspace-wide dev dep
pnpm wrangler login              # opens browser, OAuth flow
```

`wrangler whoami` should now print your account ID. Save it — you'll paste it into `wrangler.toml`.

### 3. Create the R2 bucket

Generated songs, preludes, and the prelude manifest live here.

```bash
pnpm wrangler r2 bucket create hero-syndrome-audio
```

Note: R2 requires opting into the R2 service in the dashboard the first time (Cloudflare → R2 → "Get started"). It's free up to 10 GB stored + 1M class-A ops/month, which is well above MVP usage.

For public song URLs without signing, enable an R2 public bucket or attach a custom domain. For MVP, the simpler path is: song URLs route through the Worker (`GET /api/song/:sessionId/:songId` for live sessions, `GET /api/episode/:id/song/:songId` for finalized episodes) which streams the R2 object back. Keeps everything behind one origin, lets you cache-control later, and avoids opening the bucket public.

Configure the R2 lifecycle rule (dashboard → R2 → bucket → Lifecycle): expire objects under prefix `sessions/` after 7 days. The `episodes/` prefix is exempt — song audio is moved there at finalize time.

### 4. Create the KV namespace

Episodes and upstream proxy caches live here. (Per-session mutable state lives in the Durable Object, not KV.)

```bash
pnpm wrangler kv namespace create EPISODES
pnpm wrangler kv namespace create EPISODES --preview     # for local dev
```

Both commands print an `id` and `preview_id`. Copy them.

### 5. `apps/worker/wrangler.toml`

```toml
name = "hero-syndrome-worker"
main = "src/index.ts"
compatibility_date = "2026-04-01"

account_id = "<your account id>"

[[r2_buckets]]
binding = "AUDIO"
bucket_name = "hero-syndrome-audio"

[[kv_namespaces]]
binding = "EPISODES"
id = "<id from step 4>"
preview_id = "<preview id from step 4>"

# Session Durable Object — strongly-consistent per-session state.
[[durable_objects.bindings]]
name = "SESSION_DO"
class_name = "SessionDO"

[[migrations]]
tag = "v1"
new_classes = ["SessionDO"]

# R2 lifecycle — Cloudflare doesn't yet expose lifecycle in wrangler.toml,
# so configure via the dashboard (or `wrangler r2 bucket lifecycle add`):
# rule: prefix = "sessions/", expire after 7 days. The "episodes/" prefix
# is exempt; song audio is moved there at finalize time.

[vars]
# non-secret config goes here
```

The `[[migrations]]` block tells Cloudflare the `SessionDO` class exists. The first time `wrangler deploy` runs after adding it, the new DO class is provisioned.

### 6. Secrets

Never commit API keys. Use Wrangler secrets:

```bash
pnpm wrangler secret put ANTHROPIC_API_KEY      # paste when prompted
pnpm wrangler secret put ELEVENLABS_API_KEY
```

For local dev, mirror these in `apps/worker/.dev.vars` (gitignored):

```
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
```

### 7. Local dev

```bash
pnpm wrangler dev                # local Worker on :8787 with .dev.vars
pnpm --filter web dev            # Vite on :5173 with /api/* proxied to :8787
```

### 8. Deploy

Worker:

```bash
pnpm wrangler deploy
```

This gives you a `hero-syndrome-worker.<account>.workers.dev` URL. The web app hits this from production.

Web app to Cloudflare Pages:

```bash
pnpm --filter web build
pnpm wrangler pages deploy apps/web/dist --project-name hero-syndrome
```

First deploy creates the project. Subsequent deploys update it. You get a `hero-syndrome.pages.dev` URL.

### 9. (Optional) Custom domain

If you have a domain in Cloudflare, attach it to Pages in the dashboard. PWAs need HTTPS, which both `*.pages.dev` and custom domains provide automatically.

### 10. CORS

The Worker needs to allow `https://hero-syndrome.pages.dev` (and `http://localhost:5173` in dev). Add a top-level CORS handler in `apps/worker/src/index.ts` that responds to `OPTIONS` and adds `Access-Control-Allow-Origin` for those two origins.

---

## Aesthetic direction

The brief: *quirky, creative, interesting.* Avoid both bland-SaaS and overdesigned-portfolio. The piece is sincere about an absurd premise; the visuals should match.

Some specific moves to try in Phase 9:

- **Type.** A chunky display serif (Editorial New, Old Standard TT, free alternatives like Cooper Hewitt + a serif). Avoid Inter. Avoid SF.
- **Color.** One bold accent against off-white in light mode, off-black in dark mode. The accent shifts subtly with `placeType` (cyan near water, sodium-orange in urban-night, sage in parks). Avoid gradients-on-everything.
- **Visualization.** Not an oscilloscope. Try: a slow-rotating organic blob (think Lava Lamp meets MRI scan) whose size pulses to RMS and whose deformation is driven by the autocorrelation peak. Or a single drifting circle that leaves a trail. The *literal* waveform is the boring choice.
- **Stickers.** Oversized emoji that wobble like jelly when added. They drift slowly across the screen. Decay is both opacity *and* size — they shrink and fade.
- **Motion.** Everything slightly springy, slightly delayed. Nothing snaps. CSS transitions everywhere with `cubic-bezier` curves that overshoot.
- **Sound design of UI itself.** A short pluck or chime when stickers land, mixed quietly under the music. This is an art piece — it should feel composed.
- **Episode page.** A vertical scroll: title at top in display type, timeline as a single glyph-strip across the middle, big play button. No metadata table, no "stats". The timeline glyphs ARE the metadata.

These are starting moves, not commandments. Riff on them.

---

## Risks and open questions

Already in `architecture.md` under *Open technical questions*; the ones most likely to bite during MVP:

1. **iOS screen-locked Web Audio in a PWA.** Single biggest existential risk to the experience. Test on real hardware on day 2, before the rest of the app exists. If broken, fallback is a silent `<audio>` audio-session anchor; if still broken, the experience pivots to screen-on / in-hand and the concept doc framing changes.
2. **ElevenLabs `composition_plan` latency for full songs.** If a 4-min song takes > 90 s to generate, the lead-time math still has headroom, but if it's >3 min we may need to keep N+2 also in flight or shorten target song length. Measure as soon as `/generate` returns end-to-end.
3. **ElevenLabs respecting the composition structure.** If section boundaries are ignored, fall back to single-section compositions with long combined prompts. The Claude tool-call contract stays the same.
4. **ElevenLabs cost beyond free credits.** Free credits cover MVP and a small demo. Sustained use needs either paid credits, a self-hosted alternative (MusicGen on a cheap GPU), or a stem-based hybrid. Decide before the free tier runs out, not after.
5. **Nominatim / Overpass usage.** Both are free under "be a good citizen" rules. Cache aggressively (already in design) and identify yourself in `User-Agent`. If we ever share this beyond a demo, swap to Mapbox or Stadia.
6. **DeviceMotion permission denial.** iOS users routinely deny motion. The fallback (clock + weather + location only) is degraded but still functional — make sure the app doesn't crash or sit silent.
7. **R2 egress for song playback.** Each session is ~6 songs × ~5 MB = ~30 MB. Multiple users replaying episodes adds up but stays within Cloudflare's free tier (1M class-B ops/month, ~10 GB egress) for MVP demo traffic.

---

## Definition of done

The MVP is shippable when, on a fresh install on both an iPhone and an Android phone:

1. Tap Start → audio begins within 3 s.
2. Walk outside / change rooms / drop a sticker — within 1 song boundary (≤6 min), the next song perceptibly responds.
3. Lock the screen for 30 s — audio continues (ideally; document and accept any iOS-specific failure).
4. Tap End → episode URL loads on a *different* device and replays the same songs in order with title and timeline.
5. No console errors. No silent failures.
6. Worker logs show structured request records for every `/generate`; `/api/debug/session/:sessionId` returns the full event log for any recent session.

Below that bar is not MVP. Above that bar is iteration.

---

## Later features

Both designed to slot into the existing architecture without rework. See `architecture.md` → *Later features* for the design.

- **Microphone.** (a) Ambient sound sensing — derive loudness, voice-activity, dominant frequency band on-device, ship summary stats only. Distinguishes "noisy bar" from "quiet bedroom." Gated by `motionClass` so we don't trust pocketed-mic readings (which are noise). (b) Verbal scene direction — "speak to the score" affordance: hold a button, say "make it more urgent," release; the transcript becomes a high-priority intent token in the next song.
- **Camera.** User taps "what does it look like here," captures one frame on-device, we extract a 3-color dominant palette + a coarse scene tag (indoor/outdoor, nature/built). Ship the derived signals, never the image. One-shot input that influences the next 1–2 songs and decays.

Both deferred for MVP because they require extra permission prompts (potential friction on first run) and depend on the phone being out of pocket to be useful — easier to validate the passive-sensor experience first.
