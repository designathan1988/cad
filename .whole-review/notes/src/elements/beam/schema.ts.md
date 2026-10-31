# src/elements/beam/schema.ts
Lines: 53
Summary: The beam element: a bar between two points of a level hanging from the level's top (with offsets at start and end), its width and depth, a rectangle or I section; defaults; its section polygon, id check and plan outline.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: hangs from the level's top; dashed in plan (above the cut), solid in 3D; goes with its grid axis
- 5 imports: vector helpers
- 7-10 BEAM_PREFIX 'beam'; new beam 15 × 40 cm
- 12-28 Beam: id, level, axis start/end, width, depth, top offset, end offset (sloping), shape, plate
- 30-31 BEAM_PLATE 12 mm
- 33-44 beamSection: a rectangle, or an I with flanges t thick (the plate, at most a third of width and depth) and a web t wide, counter-clockwise seen from the start
- 46 isBeamId: the prefix and underscore (case-sensitive)
- 48-52 beamOutline: the axis offset by half the width each side, counter-clockwise (right side first)

## Contracts, state and data flow
- No validator here: reading files checks beams elsewhere (kinds/beam.ts or project-file.ts: to check).
- A zero-length beam normalizes to the zero vector and its outline collapses (the tool refuses lengths under MIN_WALL_LENGTH: kind-tools.ts:167).

## Depends on / used by
- uses: core/vector.ts
- used by: elements/beam/commands.ts, fields.ts, elements/kinds/beam.ts, app/kind-tools.ts, app/next-element.ts

## Problems found (finding IDs)
- none

## To check in other files
- elements/kinds/beam.ts: validation of width/depth/plate

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith : case-sensitive, boolean (line 46)
