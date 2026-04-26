# Hero Syndrome

A mobile web art piece that scores your life as you live it. Tap **Start scene** and the app reads your phone's sensors — time of day, motion, weather, where you are, what mood stickers you tap onto the screen — and uses them to direct an adaptive playlist of generated music. End the scene and the session saves as a shareable **episode**: title, timeline, and the songs that played.

It is not a music generator, a fitness app, or a wellness app. It is a sincere, slightly absurd art piece about treating yourself like the protagonist of a film whose score is being composed in real time.

## How it works

- **Sensors → state vector.** Clock, geolocation, motion, weather, and sticker placements aggregate into a structured `StateVector` updated every ~5 seconds.
- **State vector + recent songs → composition plan.** Claude (Haiku) reads the state vector, the active stickers, and the last 3 songs, then returns a structured `composition_plan` for the next song via Anthropic tool use.
- **Composition plan → song.** ElevenLabs Music renders the plan as a single 3–6 minute song. Songs play back-to-back as a curated playlist; transitions are intentional, not stitched.
- **Cold-start prelude.** A bank of 25 short pre-generated opener tracks (bucketed by time-of-day × motion intensity) plays instantly while the first generated song is rendering.
- **End → episode.** A finalize call writes an immutable episode record with a generated title, the song list, and the sticker timeline. Replay anywhere via an opaque shareable URL.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind + Zustand, installable as a PWA via `vite-plugin-pwa`. Web Audio for the two-buffer playlist queue.
- **Backend:** Cloudflare Worker (HTTP router) + Session Durable Object (per-session state, strongly consistent) + R2 (audio) + KV (episode index, upstream proxy cache). Deployed on Cloudflare Pages + Workers.
- **LLM:** Claude Haiku 4.5 via the Anthropic API, called with tool use for structured `compose_song` output.
- **Music:** ElevenLabs Music API (`composition_plan` mode).
- **Free upstream APIs:** Open-Meteo (weather), Nominatim (reverse geocoding), Overpass (nearby POIs).

No accounts, no auth, no user-level analytics. Episodes live by URL.

## Repository layout

```
hero-syndrome/
├─ apps/
│  ├─ web/             # Vite + React + TS PWA
│  ├─ worker/          # Cloudflare Worker router + Session Durable Object
│  └─ prelude-gen/     # one-shot CLI for the cold-start prelude bank
├─ packages/
│  ├─ shared/          # StateVector, Sticker, SongMetadata, Composition, API types
│  └─ llm/             # Anthropic + ElevenLabs call modules (shared by worker + prelude-gen)
└─ docs/               # concept.md, architecture.md, mvp-plan.md
```

## Documentation

- [`docs/concept.md`](docs/concept.md) — premise, experience, design principles.
- [`docs/architecture.md`](docs/architecture.md) — full system design, schemas, prompt template, derivations, deployment.
- [`docs/mvp-plan.md`](docs/mvp-plan.md) — scope cuts, build units, Cloudflare setup walkthrough, definition of done.

## Later features

Designed to slot into the existing architecture without rework. Deferred from MVP to validate the passive-sensor experience first and avoid extra permission prompts on first run.

- **Microphone** — (a) ambient sound sensing (loudness, voice-activity flag, dominant frequency band), summary stats only, gated by `motionClass` so we don't trust pocketed-mic readings; (b) verbal scene direction — hold a button, speak ("make it more urgent"), the transcript becomes a high-priority intent token in the next song.
- **Camera** — user taps "what does it look like here," captures one frame on-device. We extract a 3-color dominant palette and a coarse scene tag (indoor/outdoor, nature/built) and ship those as state-vector signals. The image itself never leaves the phone.

## Status

In active design. See [`docs/mvp-plan.md`](docs/mvp-plan.md) for the build plan and definition of done.
