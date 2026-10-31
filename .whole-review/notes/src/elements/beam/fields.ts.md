# src/elements/beam/fields.ts
Lines: 46
Summary: The beam's panel fields: length (readout, "—" when the selected beams differ), width, depth, shape (rectangle or I), I plate thickness (only when all are I), top offset and end offset (a sloping beam).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the beam's panel fields (rows built by ui/fields.ts)
- 3-8 imports: lengthText, distance, Field, BeamPatch, Beam/BEAM_PLATE, t
- 10-12 BeamFieldActions: updateBeams
- 14-25 beamFields: the ids; length readout, one value when all equal (within 1e-9), else "—"
- 26-27 width and depth: numbers, min 5 cm (the command itself accepts anything > 0)
- 28-39 shape: segmented rect / I
- 40 plate: min 2 mm, 3 decimals, shown only when every selected beam is I
- 41-45 top offset; end offset (shows the top offset when it has none of its own)

## Contracts, state and data flow
- One field list per beam kind, used both for a selected beam and for the next beam (next-element.ts nextFields filters this same list): the pattern the goal asks for.

## Depends on / used by
- uses: ui/units.ts, core/vector.ts, ui/fields.ts (type), elements/beam/commands.ts (type), elements/beam/schema.ts, ui/i18n.ts
- used by: elements/kinds/beam.ts (fields)

## Problems found (finding IDs)
- none

## To check in other files
- ui/fields.ts: how min and "when" are applied

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : short-circuits on the first falsy result; true for an empty list (lines 23, 40)
