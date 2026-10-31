# src/elements/dimension/schema.ts
Lines: 43
Summary: The permanent dimension: two anchored ends (on a wall from an end with along/offset, on an opening's jamb with offset, or a free point), the line's offset, an optional locked length, chain id and EQ flag; id check; the element an end is held by.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: kept with the project; each point held by what it was put on; moving/stretching/thickening the wall moves the point
- 6 imports: Point2
- 8 DIM_PREFIX 'dim'
- 10-19 DimAnchor: a discriminated union by kind (wall: end, along, offset; opening: jamb, offset; point: at)
- 21-37 Dimension: id, level, ends, offset (left of a→b), locked length, chain id, eq
- 39 isDimId: prefix and underscore
- 41-42 anchorElement: the wall's or opening's id, null for a point

## Contracts, state and data flow
- No validator here (kinds/dimension.ts: to check the file reader's checks).

## Depends on / used by
- uses: core/vector.ts (type)
- used by: elements/dimension/* (anchor, auto, commands, constraints, fields), elements/kinds/dimension.ts, app/kind-tools.ts, app/select-drag.ts, app/selection-ui.ts (isDimId)

## Problems found (finding IDs)
- none

## To check in other files
- elements/kinds/dimension.ts valid(): anchors checked by kind

## Sources
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html : discriminated unions narrow on a literal kind in if/switch (lines 16-19, 42)
