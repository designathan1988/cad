# src/elements/grid/fields.ts
Lines: 28
Summary: A grid axis's panel fields: its name (only when one axis is selected) and its length (readout, "—" when several differ).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: the grid axis's panel fields
- 3-6 imports: lengthText, distance, Field, Grid
- 8-10 GridFieldActions: renameGrid
- 12-16 gridFields: the name field for a single axis only (as const keeps kind 'text' literal)
- 17-27 the length readout: one value or "—"

## Contracts, state and data flow
- No field tells the user which walls/columns go with the axis (F-0051: the link is not shown).

## Depends on / used by
- uses: ui/units.ts, core/vector.ts, ui/fields.ts (type), elements/grid/schema.ts (type)
- used by: elements/kinds/grid.ts (fields)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html : as const on an object literal makes readonly literal-typed properties (line 16)
