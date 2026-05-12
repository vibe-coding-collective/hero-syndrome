# Dynamic Dial Data Flow

Date: 2026-05-12

Primary route: `/prototype/disk-ui`

## Purpose

The prototype now separates collected device/environment data from the circular
UI. The UI reads one local demo snapshot, converts it into a dial view model,
lets the user choose vibe options from generated circular lists, and emits a
composition-ready package for the future composition-plan step.

No music generation is triggered in this pass.

## Current Local Data Source

`apps/web/src/data/dynamicDialDemo.ts` contains a local demo snapshot shaped like
the future returned device dataset:

- time: timestamp, hour, phase, day of week
- weather: temperature, humidity, condition, precipitation, cloud, wind,
  sunrise/sunset proximity
- location: movement speed, body activity, place, road, nearby POIs,
  neighborhood/city/country metadata
- movement: normalized intensity and motion pattern
- cosmic: optional space weather
- derived: location type, phrase material/force, BPM/key/duration, mood tags,
  energy stack, texture keys

This file is intentionally plain TypeScript data so it can be replaced by a
Supabase query adapter later without changing the dial component.

## View Model

`apps/web/src/prototype/dialViewModel.ts` owns the conversion rules:

- `buildDialViewModel(snapshot, hourOverride)` creates render labels, day/night
  state, weather labels, orb colors, location options, and activity options.
- Location options are scored from classified location type, primary place,
  neighborhood, city, and nearby POIs.
- Activity options are scored from body activity, motion pattern, motion
  intensity, weather, time phase, and mood tags.
- Both lists are capped at 8 options through `MAX_OPTIONS`.

The option shape is:

```ts
{
  id: string;
  kind: 'location' | 'activity';
  label: string;
  value: string;
  score: number;
  source: string;
}
```

## Composition Package

`buildCompositionReadyPackage(model, selectedLocation, selectedActivity)`
returns the package that the future composition-plan generator should consume:

```ts
{
  version: 'dial-composition-package.v1';
  snapshotId: string;
  capturedAt: string;
  selected: {
    hour;
    phase;
    weatherCondition;
    location;
    activity;
  };
  state: {
    time;
    weather?;
    location?;
    movement;
    cosmic?;
  };
  music: {
    bpm;
    key;
    totalDurationMs;
    material;
    force;
    phraseOfTheMoment;
    locationType;
    moodTags;
    energy;
  };
  candidates: {
    locations;
    activities;
  };
}
```

## Current UI Binding

`apps/web/src/components/DiskUiPrototype.tsx` renders the dial from the view
model:

- top arc button: generated location list with neighbor affordance text
- bottom arc button: generated activity/vibe list with neighbor affordance text
- purple overlay: shared circular selection wheel for either option kind
- clock orbit: changes the hour override, sun/moon position, phase, and day/night
  theme
- center graphic: official ElevenLabs UI Orb registry component sized to match
  the previous center image
- lower-left readouts: compact display of collected weather, motion, place,
  BPM/key, and selected options

## Live Prototype Data

The dial can now run from either local demo data or live device data:

- default state: local demo snapshot, music generation disabled
- `START DATA` button: starts `MotionSensor`, `GeolocationSensor`, and
  `StateAggregator`
- live state: reads `stateVector` from the existing Zustand store
- `snapshotFromStateVector` maps the live state into the dial snapshot shape
- BPM/energy now come from the upstream `@hero-syndrome/musical-schema`
  `metaToPlan` pipeline

Music generation remains behind `ENABLE_DIAL_MUSIC_GENERATION = false` in
`DiskUiPrototype.tsx`. The page emits the package in
`#hero-dial-composition-package` with:

```json
{
  "generation": {
    "musicEnabled": false,
    "target": "disabled_prototype"
  }
}
```

## Supabase Transition Notes

When moving to Supabase Postgres, keep the UI contract stable:

- fetch a latest `DialDemoSnapshot`-compatible record or assemble that shape in a
  query adapter
- pass the snapshot into `buildDialViewModel`
- continue producing `CompositionReadyPackage` before any ElevenLabs or
  composition-plan API call

This keeps storage, dial rendering, and composition generation separated.
