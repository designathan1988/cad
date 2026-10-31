# src/elements/curtain/geometry.ts
Lines: 71
Summary: A curtain wall as built (pure): outline in plan, vertical and horizontal grid lines, mullions over the full height at each vertical line, transoms between mullions at each horizontal line, and a pane or opaque panel in each cell, all as plan rectangles between heights.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: mullions full height, transoms between them, panels in cells; pure
- 5-6 imports: vector helpers, Curtain/gridLines
- 8-13 CurtainBox: plan polygon (CCW) between bottom and top
- 15-26 CurtainSolid: the curtain, outline, bottom/top, length, grid lines, frame and panel boxes
- 28-30 PANE 24 mm, OPAQUE 40 mm
- 32-39 curtainSolid: direction (x axis for a zero length), normal, bottom = floor + base offset, height (at least 10 cm; the level's when unset), top
- 40-45 box(t0, t1, across, z0, z1): a rectangle along the curtain
- 46-52 grid lines along and up; the mullion size (at most a quarter of the length); each mullion centred on its line and clamped inside the ends
- 53-60 per pair of mullions, the cell's span; transoms centred on each horizontal line, clamped inside foot and head (recomputed for every cell), 80 % of the depth
- 61-66 panels between transoms (glass or opaque thickness)
- 67-70 the outline (the depth either side) and the solid

## Contracts, state and data flow
- Pure; clamps use min(max(x, lo), hi), which returns hi when lo > hi (a very short curtain): the mullion size cap (length/4) keeps lo ≤ hi along; up, height − m stays ≥ 0 because height ≥ 0.1 and the field's mullion min is 0.01 (a file could hold more).

## Depends on / used by
- uses: core/vector.ts, elements/curtain/schema.ts (gridLines)
- used by: elements/kinds/curtain.ts (derive, plan, solid), elements/curtain/fields.ts (type)

## Problems found (finding IDs)
- none

## To check in other files
- elements/curtain/schema.ts gridLines and the validator's limits on mullion

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/max : NaN propagates; min(max(x, lo), hi) is hi when lo > hi (lines 51, 59)
