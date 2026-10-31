# src/elements/grid/schema.ts
Lines: 55
Summary: The grid axis element (name, start, end; on every level), id check, the next letters (A → B, Z → AA), the next axis's name (numbers up and down the plan, letters across) and the walls lying on an axis.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: named structural lines, the same on every level; walls on an axis go with it; saved and undone
- 5 imports: vector helpers
- 7 GRID_PREFIX 'grid'
- 9-15 Grid: id, name, start, end
- 17 isGridId: prefix and underscore
- 19-32 nextLetters: increments the last letter, carrying Z → A (AZ → BA; ZZ → AAA)
- 34-45 nextGridName: an upright axis gets the highest number + 1; a lying one the letters after the last (sorted by length, then alphabetically with localeCompare: alphabetical for A–Z), or A
- 47-54 onGrid: walls whose both ends are within 1 mm of the axis's INFINITE line (not limited to its ends) and that have a length

## Contracts, state and data flow
- The carried walls are decided by geometry alone (F-0051 confirmed here: infinite line, every wall of every level since grids have no level).

## Depends on / used by
- uses: core/vector.ts
- used by: elements/grid/carry.ts (onGrid), app/kind-tools.ts (nextGridName, GRID_PREFIX), elements/kinds/grid.ts, app/selection-ui.ts (isGridId)

## Problems found (finding IDs)
- F-0051 (onGrid's infinite line at 52-53)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare : sign of the result, locale-dependent; uppercase A–Z strings sort alphabetically (line 43)
