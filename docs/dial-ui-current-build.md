# Dial UI Baseline Reference

Date: 2026-05-12

Branch at time of note: `prototype/disk-ui`

Primary route: `/prototype/disk-ui`

This captures the dial state before the dynamic data refactor and orb
replacement. Use it as the visual rollback reference if later dynamic passes
drift away from the working co-centric dial composition.

Primary files:

- `apps/web/src/components/DiskUiPrototype.tsx`
- `apps/web/src/pages/DiskPrototype.tsx`
- `apps/web/src/index.css`
- `apps/web/public/prototype-dial/*`

## Current Visual Contract

The prototype is an iPhone 7-sized SVG artboard using a fixed frame of `393 x 852`.
The dial center is fixed at `(197, 426)`. Every circular layer is expected to be
co-centric around that point.

The screen is built from:

- A full-screen background image plus day/night tint.
- A fixed outer ring and clock/orbit layer.
- A draggable sun/moon indicator on a 24-hour orbit.
- A fixed center circle currently filled by `center-photo.png`.
- A top dark annular arc button for location selection.
- A bottom dark annular arc button for activity selection.
- Curved material labels around the center ring.
- A purple blurred overlay for location selection, with a draggable circular list.

## Current Interaction Contract

- Dragging the main orbit changes `selectedHour`.
- `selectedHour` controls:
  - sun/moon position,
  - day/night background,
  - weather icon variant,
  - phase label,
  - top material label.
- The top arc button opens the location selection overlay.
- Dragging the overlay wheel changes the selected location.
- Confirming the overlay returns to the main dial and keeps the selected location.
- The location button displays neighboring-list affordance text:
  `previousTail . CURRENT . nextHead`.
- The bottom arc button cycles activity labels.
- A short synthesized tick plays when a dial selection changes.

## Current Fixed Data

Hardcoded options live inside `DiskUiPrototype.tsx`:

- `LOCATION_OPTIONS`: `OFFICE`, `PARK`, `SHOP`, `MUSEUM`, `UNIVERSITY`,
  `SCHOOL`, `CAFE`, `HOME`
- `BOTTOM_BUTTON_LABELS`: `RUNNING`, `WALKING`, `CHILLING`
- Sunrise hour: `6`
- Sunset hour: `18`
- Default hour: `3`

## Current Geometry Notes

Important constants in `DiskUiPrototype.tsx`:

- `FRAME = { width: 393, height: 852 }`
- `DIAL_CENTER = { x: 197, y: 426 }`
- `SUN_ORBIT_RADIUS = 147`
- `OUTER_RADIUS = 181`
- `LOCATION_LABEL_RADIUS = 119`
- `BUTTON_INNER_RADIUS = 72`
- `BUTTON_OUTER_RADIUS = 96`
- `BUTTON_TEXT_RADIUS = 84`
- `BUTTON_ARC_SPAN = 92`

The labels are rendered with SVG `textPath` arcs. The selection overlay also
uses generated arcs for every dynamic option and separator dot.

## Known Fragile Areas

- The local prototype branch is behind latest `origin/main`, where state names
  have changed from older `motionClass/placeType` style to newer
  `bodyActivity/locationType` style.
- The current center graphic is a static bitmap and should be replaced by an
  orb component without changing the visual circle size.
- The current location and activity lists are static and should become generated
  from a state-to-dial view model.
- The current sunrise/sunset values are hardcoded. The live weather response only
  has sunrise/sunset proximity minutes, not absolute sunrise/sunset timestamps.

## Rollback Guidance

If a future dial pass drifts visually, compare against this reference and the
pre-dynamic version of:

- `apps/web/src/components/DiskUiPrototype.tsx`
- `apps/web/src/index.css`

The key recovery targets are: fixed iPhone frame, co-centric center point,
curved text on generated arcs, purple selection overlay, draggable 24-hour
orbit, and arc buttons sitting tightly around the center circle.
