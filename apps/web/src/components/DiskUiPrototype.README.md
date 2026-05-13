# Disk UI Prototype

This document explains the current `DiskUiPrototype` UI for human collaborators
and AI agents working on the Hero Syndrome / VCC music app prototype.

The route currently used for local testing is:

```text
/prototype/disk-ui
```

The main implementation lives in:

```text
apps/web/src/components/DiskUiPrototype.tsx
apps/web/src/index.css
```

## Product Intention

The disk UI is an experimental iPhone-first music interface. It turns a user's
environmental and activity data into a tactile "vibe selector" for personalized
music. The long-term product direction is:

- collect device and environment data
- summarize that data into a structured state vector
- let the user adjust/select the vibe through circular touch controls
- create a composition package from those selections
- generate music with ElevenLabs
- store generated music in the backend
- play the generated track back in the app
- build up the user's personal playlist over time

The current prototype does not generate music. It demonstrates the interaction
model, visual system, state display, loading/progress behavior, and local audio
playback flow.

## Current UI Structure

The UI is built as a 393 x 852 SVG artboard, sized to match an iPhone 7-style
screen. Most circular elements use shared math around `DIAL_CENTER`, so new
rings should stay concentric with the center Orb.

The main visual layers are:

- dynamic day/night/weather background
- outer 24-hour clock ring
- sunrise/sunset horizon line
- sun or moon position indicator
- phase label such as `AFTERNOON` or `NIGHT`
- music loading/playback progress ring
- center ElevenLabs-style Orb
- top and bottom annular selector buttons
- data readout text
- local demo controls for day/night music and stop

## Time And Weather Layer

The outer ring represents a 24-hour day. The sun/moon indicator moves around the
ring based on the current hour. Sunrise and sunset are drawn as the straight
horizon line across the ring.

When the state is after sunset or before sunrise, the artboard switches to the
night theme. In night mode:

- the background becomes dark
- stars appear
- the weather icon changes to the night/moon treatment
- the moving sun indicator becomes a moon indicator
- ring colors adapt for legibility

## Progress Ring

The music progress/loading ring is not an image asset. It is generated with
math from the same center as the Orb.

The ring has three parts:

- full backing ring, used to make the progress path visually pop
- light grey full track
- darker active segment for loading or playback progress

The active segment starts from the live sunrise angle. During simulated loading
it grows from 0 to 100 percent. During playback it reflects audio progress.

The segment uses flat ends, not rounded caps.

## Center Orb

The center Orb uses the local ElevenLabs-style Orb component in:

```text
apps/web/src/components/ui/orb.tsx
```

Current behavior:

- when music is playing, the Orb uses `agentState="talking"`
- when music is not playing, the Orb uses the idle/null agent state
- Orb colors are taken from the current weather/day-night view model
- Orb color choices are temporary and should be refined later

The Orb is wrapped in both:

- an SVG circular clip path
- a real annular bezel ring with a center hole

This is intentional. The WebGL canvas can show rectangular edge artifacts inside
an SVG `foreignObject`, especially in browser/iPhone-style rendering. The clip
cuts the canvas to a circle, while the bezel hides remaining edge artifacts and
keeps the center graphic visually integrated with the dial.

## Top And Bottom Selector Buttons

The two dark annular 1/4-circle controls are actual buttons:

- top button: location/place selector
- bottom button: activity selector

The text on each button is curved along its ring. It includes pieces of adjacent
options to create affordance, so the user can discover that the button opens a
selection dial.

Pressing one of these buttons opens a blurred overlay with a circular selection
wheel. The user can rotate the wheel and select the item aligned with the top
selection area.

## State Vector And Dynamic Options

The UI is driven by a view model created from a state vector. For now, it can
use demo data, simulated day/night data, or live device data where available.

Relevant files:

```text
apps/web/src/prototype/dialDataAdapter.ts
apps/web/src/prototype/dialViewModel.ts
apps/web/src/data/dynamicDialDemo.ts
apps/web/src/state/store.ts
```

The ring options should remain dynamic. If data returns many possible places or
activities, the adapter/view model should reduce them to the most relevant set
for the dial rather than hard-coding a fixed list in the component.

## Local Audio Demo

The current app has local demo buttons:

- `DAY MUSIC`
- `NIGHT MUSIC`
- `STOP MUSIC`

These buttons are only for showcasing the playback, loading, progress ring, and
Orb states before ElevenLabs generation is wired into the backend.

For local demo audio, use:

```text
apps/web/public/prototype-dial/audio/day-demo.mp3
apps/web/public/prototype-dial/audio/night-demo.mp3
```

The files themselves should not be committed unless the team explicitly decides
to keep sample media in Git. See:

```text
apps/web/public/prototype-dial/audio/README.md
```

## Future Backend Direction

The final app should not depend on local public audio files. The intended
production direction is:

- state vector and user selection create a composition package
- backend worker sends the composition plan to ElevenLabs
- backend stores generated audio in durable storage
- database stores a composition/session/track record
- client receives a playable URL or signed URL
- playback state drives the progress ring and Orb

Supabase/Postgres can later hold the structured user/session/composition data.
Audio files should live in backend storage, not in the frontend source tree.

## AI Agent Working Notes

When editing this UI:

- keep rings concentric with `DIAL_CENTER`
- avoid replacing math-generated rings with static image assets
- preserve touch-first behavior for iPhone testing
- do not commit uploaded/generated audio unless explicitly requested
- keep music generation disabled unless asked to wire the backend path
- keep selector options data-driven through the adapter/view model
- preserve curved text on circular controls
- run `npx pnpm@9.12.3 --filter web build` after code changes

If the Orb shows rectangular artifacts again, first inspect the clip path and
bezel order before changing Orb internals.
