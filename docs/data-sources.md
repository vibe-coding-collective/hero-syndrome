# Data Sources

Hero Syndrome reads from a small set of external data sources at runtime, and ships with two static vocabularies built from open texts and curated lists. This document is the master attribution index: every external bit that influences a generated song traces back to an entry here.

For each source: what it provides, the URL it's drawn from, the license, and where in the codebase it's used.

## Conventions

- **License key:** `PD` = US public domain · `CC0` = Creative Commons Zero · `CC BY` = attribution · `CC BY-SA` = attribution + share-alike · `CC BY-NC` = non-commercial · `Open data` = openly licensed but verify per-source.
- **License notes:** factual word lists (mineral names, geographic feature terms) are not themselves copyrightable in most jurisdictions, but we cite the assembling source per scholarly convention.
- **Vocabulary versioning:** every static vocab file has a `version` field. Bumping the version triggers a fresh build; old versions remain pinned to historical episodes.

---

## 1. Real-time APIs (server-side)

### NOAA Space Weather Prediction Center (SWPC)

Three feeds, fetched per `/cosmic` call (cached 90 s):

| Feed | URL | Provides | License |
|---|---|---|---|
| Planetary K-index | `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json` | Geomagnetic disturbance level (0–9) | PD (US gov) |
| Solar wind plasma | `https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json` | Solar wind speed (km/s) and density (particles/cm³) | PD (US gov) |
| GOES proton flux | `https://services.swpc.noaa.gov/json/goes/primary/differential-protons-6-hour.json` | 13-channel differential proton flux (1.02–404 MeV) | PD (US gov) |

**Used in:** [`apps/worker/src/cosmic.ts`](../apps/worker/src/cosmic.ts) (orchestrator), [`apps/worker/src/cosmic/cosmicWord.ts`](../apps/worker/src/cosmic/cosmicWord.ts) (proton flux → cosmic word), [`apps/worker/src/cosmic/phraseOfTheMoment.ts`](../apps/worker/src/cosmic/phraseOfTheMoment.ts) (k-index + solar wind → phrase of the moment).

### Open-Meteo

URL: `https://api.open-meteo.com/v1/forecast`. Provides temperature, humidity, precipitation, wind, cloud cover, sunrise/sunset, weather condition (WMO code).

**License:** Open data, attribution requested.
**Used in:** [`apps/worker/src/weather.ts`](../apps/worker/src/weather.ts).

### OpenStreetMap Nominatim

URL: `https://nominatim.openstreetmap.org/reverse`. Provides reverse geocoding: place type, road, neighborhood, city, country, postal code.

**License:** ODbL (Open Database License).
**Used in:** [`apps/worker/src/geocode.ts`](../apps/worker/src/geocode.ts).

### OpenStreetMap Overpass API

URL: `https://overpass-api.de/api/interpreter`. Provides nearby points of interest (shops, amenities, leisure features) within a small radius.

**License:** ODbL (Open Database License).
**Used in:** [`apps/worker/src/nearby.ts`](../apps/worker/src/nearby.ts).

### Australian National University Quantum Random Number Generator (ANU QRNG)

URL: `https://qrng.anu.edu.au/`. Provides true random bytes drawn from quantum vacuum fluctuations measured at the ANU Department of Quantum Science. Sixteen bytes are pulled per song generation; a buffer is refilled by a 2-minute cron.

**License:** Free public service.
**Used in:** [`apps/worker/src/quantumDO.ts`](../apps/worker/src/quantumDO.ts).
**Fallback:** if the QRNG service is unavailable, we degrade to `crypto.getRandomValues` and label the source `pseudo` on the episode receipt.

---

## 2. LLM and music APIs

### Anthropic Messages API (Claude Haiku 4.5)

URL: `https://api.anthropic.com/v1/messages`. Composes the next song's metadata + composition plan via the forced `compose_song` tool. Also titles episodes and (offline) filters the cosmic-word vocabulary for evocativeness.

**Used in:** [`packages/llm/src/anthropic.ts`](../packages/llm/src/anthropic.ts).

### ElevenLabs Music API

URL: `https://api.elevenlabs.io/v1/music`. Renders the composition plan to audio (MP3, instrumental).

**Used in:** [`packages/llm/src/elevenlabs.ts`](../packages/llm/src/elevenlabs.ts).

---

## 3. Cosmic-word vocabulary (`@hero-syndrome/cosmic-vocab`)

A 256-word slice, redrawn daily from a stable approved pool, used as the nearest-neighbor target for the GOES proton flux projection.

### EFF Long Word List

URL: <https://www.eff.org/dice>. The starting wordlist used for diceware-style passphrases.

**License:** CC BY 3.0 (Electronic Frontier Foundation).
**Role:** seed for the approved pool. Filtered by Claude Haiku for evocativeness; the surviving subset is the static `approved-pool.json`.
**Used in:** [`apps/cosmic-vocab-gen/src/downloadEffList.ts`](../apps/cosmic-vocab-gen/src/downloadEffList.ts), [`apps/cosmic-vocab-gen/src/filterEvocative.ts`](../apps/cosmic-vocab-gen/src/filterEvocative.ts).

### bge-small embeddings (`@cf/baai/bge-small-en-v1.5`)

384-dimension sentence embeddings via Cloudflare Workers AI, used to map words into the projection space.

**License:** MIT (model weights), free tier on Workers AI.
**Used in:** [`apps/cosmic-vocab-gen/src/computeEmbeddings.ts`](../apps/cosmic-vocab-gen/src/computeEmbeddings.ts), [`apps/worker/src/cosmic/cosmicWord.ts`](../apps/worker/src/cosmic/cosmicWord.ts).

Offline build: [`apps/cosmic-vocab-gen`](../apps/cosmic-vocab-gen).

---

## 4. Phrase-of-the-moment vocabularies (`@hero-syndrome/material-force-vocab`)

Two unfiltered pools — **materials** (nouns) and **forces** (gerunds) — sampled per song with quantum-byte-driven similarity-weighted softmax over the full vocab, conditioned on current space weather.

**Sourcing methodology.** The shipped pool data (versions `seed.YYYY-MM-DD`) is a hand-curated representative subset drawn from each source's domain register. Each per-source module under [`apps/material-force-vocab-gen/src/sources/`](../apps/material-force-vocab-gen/src/sources/) carries a static word list along with full provenance metadata (canonical URL, license, sourcing method). Per-word source attribution travels with the pools: the `sources` array in [`material-pool.json`](../packages/material-force-vocab/data/material-pool.json) and [`force-pool.json`](../packages/material-force-vocab/data/force-pool.json) is parallel to `words`, recording which source(s) contributed each entry.

Future expansion — live extraction directly from the canonical sources (Project Gutenberg full texts via Claude-based POS extraction; RRUFF API for the full ~5,900 IMA species; etc.) — is supported by the same orchestrator and would simply bump the `seed.*` version. The runtime treats any non-`stub` version as ready.

### Material pool sources

| # | Source | URL | License | Provides |
|---|---|---|---|---|
| 1 | RRUFF Project IMA mineral list | <https://rruff.info/ima/> | Public scientific record (IMA-CNMNC) | ~5,900 IMA-recognized mineral species names |
| 2 | The Color of Art Pigment Database | <https://www.artiscreation.com/Color_index_names.html> | Permitted reference use, attribution | Historical and modern pigment names organized by Color Index pigment codes (CI Pigment Yellow 35, etc.) |
| 3 | Cooper Hewitt Smithsonian Design Museum textile thesaurus | <https://collection.cooperhewitt.org/objects/?department=textiles> | CC0 (Smithsonian collection metadata) | Textile material and weave-type vocabulary |
| 4 | *Encyclopedia of Textiles*, Henry William Schofield, 1909 | Internet Archive / Project Gutenberg | PD | Antique textile-trade vocabulary |
| 5 | Richard Hakluyt, *The Principal Navigations, Voyages, Traffiques and Discoveries of the English Nation*, 1589–1600 | Project Gutenberg | PD | Silk Road / spice trade goods, materials of long-distance pre-modern commerce |
| 6 | Marco Polo, *The Travels* (Yule-Cordier edition) | Project Gutenberg | PD | As above |
| 7 | Sir John Mandeville, *The Travels* | Project Gutenberg | PD | As above |
| 8 | USGS Geographic Names Information System (GNIS) generic terms | <https://www.usgs.gov/u.s.-board-on-geographic-names/domestic-names> | PD (US gov) | Geographic feature generic names: kettle, esker, drumlin, glade, fen, hummock, gulch, draw, bench |

### Force pool sources

| # | Source | URL | License | Provides |
|---|---|---|---|---|
| 9 | Mrs Isabella Beeton, *The Book of Household Management*, 1861 | Project Gutenberg | PD | Cooking and household-craft gerunds (folding, reducing, simmering, rendering, blooming, infusing, steeping) |
| 10 | M. T. Richardson (ed.), *Practical Blacksmithing*, 1889 | Project Gutenberg / Internet Archive | PD | Smithing and metalworking verbs (forging, tempering, annealing, planishing, fullering, drawing-down) |
| 11 | The Wellcome Collection alchemy archive (transcribed materials) | <https://wellcomecollection.org/works> | CC BY (where transcribed) | Alchemical / apothecary process verbs (distilling, decocting, macerating, levigating, calcining, sublimating) |
| 12 | G. H. Oelsner, *A Handbook of Weaves*, 1915 | Internet Archive | PD | Weaving and textile manufacturing verbs (warping, threading, picking, beating, fulling, carding, retting); chapter headings name each weave structure |
| 13 | Douglas Cockerell, *Bookbinding and the Care of Books*, 1901 — stands in for Joseph Moxon, *Mechanick Exercises on the Whole Art of Printing*, 1683–1684 (Moxon's pre-OCR scans were not machine-readable as of sourcing) | Internet Archive | PD | Bookbinding and printing verbs |
| 14 | USGS Glossary of Geologic Terms | <https://www.usgs.gov/glossaries> | PD (US gov) | Geological process verbs (eroding, weathering, slumping, faulting, sintering, brecciating) |

### Embedding model

Same as the cosmic-vocab pool: bge-small-en-v1.5 via Cloudflare Workers AI, 384-dim.

### Quantum involvement

Five per-song quantum bytes drive the sampling: two bytes for the material softmax, two for the force softmax, one for word-order coin flip. Bytes pulled from the same ANU QRNG reservoir documented above.

Pipeline detail and runtime implementation: [`apps/worker/src/cosmic/phraseOfTheMoment.ts`](../apps/worker/src/cosmic/phraseOfTheMoment.ts). Offline build: [`apps/material-force-vocab-gen`](../apps/material-force-vocab-gen).

---

## 5. Where each source surfaces in the song

| Source category | Influences |
|---|---|
| Time (local clock) | Phase, day-of-week → mood register |
| Geolocation + Nominatim + Overpass | `state.location` (place, city, country, nearby) |
| Open-Meteo | `state.weather` |
| DeviceMotion | `state.body` (activity, motion, intensity) |
| NOAA SWPC | `state.cosmic.spaceWeather` (raw) → drives both `vibes.wordOfTheMoment` and `vibes.phraseOfTheMoment` (raw values not exposed to Claude) |
| ANU QRNG | Per-song random source for phrase sampling and word-order toss |
| Material + force vocabularies | `vibes.phraseOfTheMoment` |
| EFF wordlist + cosmic-word vocab | `vibes.wordOfTheMoment` |
| `recentHistory` from previous songs | Continuity in next song's metadata |

---

## 6. Things this project does NOT use

For transparency:

- No microphone, no camera input.
- No accounts, no analytics, no tracking cookies, no newsletter.
- No astrology, tarot, runes, I Ching, zodiac, religious or mythological referents — see [`docs/concept.md`](concept.md) for the cultural-neutrality stance.
- No personal data is sent to third parties beyond what's needed for the upstream API call (lat/lon to Open-Meteo + Nominatim + Overpass; episode audio to ElevenLabs).
- Lat/lon is rounded before caching to coarse-grain the geocoding/POI cache keys.
