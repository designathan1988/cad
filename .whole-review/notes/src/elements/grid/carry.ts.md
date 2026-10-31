# src/elements/grid/carry.ts
Lines: 29
Summary: What goes with a selected grid axis when it moves: the walls lying on it (schema.ts onGrid) and the registry's elements standing on its line (columns' centres, beams), on every level.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: walls, beams and columns on an axis go with it; pure
- 4-7 imports: Doc, distance, kindsOnLine, Grid/onGrid
- 9-16 onLine: a point within 1 mm of the axis's INFINITE line (not limited to its drawn ends)
- 18-28 wallsOnGrids: for the selected axes, the walls on them and the kinds on their lines, without repeats or ids already selected

## Contracts, state and data flow
- An implicit link: nothing marks a wall or a column as tied to an axis, nor can it be turned off; anything that happens to lie on the axis's line (on any level, even past the axis's ends) moves when the axis is dragged (select-drag.ts:169-170). Revit makes this a visible per-column choice ("Moves With Grids", Constraints) — the goal wants links only when the user makes them, shown (F-0051).

## Depends on / used by
- uses: elements/registry.ts (kindsOnLine), elements/grid/schema.ts (onGrid), core/vector.ts
- used by: app/select-drag.ts (moves), tools/transform.ts? (Modify tools: to check)

## Problems found (finding IDs)
- F-0051 an axis drags every wall and column on its line, a link nobody made

## To check in other files
- elements/grid/schema.ts onGrid: the walls' test

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-8B484FA9-1657-4EA7-BCB5-955BC96B6CFF.htm (found by search; Autodesk help "Lock Columns to a Grid"): "Moves With Grids" is a column's Constraints property the user checks; locked columns move with the grid (lines 1-2, 18-28)
