# tests/tools/smart-guides.test.ts
Lines: 46
Summary: Tests of smart guides while moving (phase 9):
- An edge snaps onto a neighbour's edge within reach, and the line through both is shown.
- Centres align, on both axes at once.
- Out of reach, the move is left as it is.
- Between two neighbours, the box snaps to equal gaps and both gaps are marked.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: edges, centres, equal gaps; nothing out of reach
- 4-8 imports: vitest, Box, smartGuides; box()
- 10-19 a left edge moved by 3 snaps to 3.04 (other's left), y unchanged; one vertical line from y 0 to 6; no gaps
- 21-26 centre x 1 + 10.97 snaps to 12 (delta 11); y 0.05 kept (nothing in reach)
- 28-32 a far box: delta unchanged, no lines
- 34-45 between [0, 1] and [5, 6]: left edge to 2.5, two gaps of 1.5; suite closes (line 46 blank)

## Contracts, state and data flow
- smartGuides(moving box, other boxes, delta, reach) returns an adjusted delta plus lines and gaps to draw. It only snaps the move and stores nothing, so it creates no lasting link. The snap of a dropped door onto a neighbour (RC2) is a separate path in select-drag.ts (F-0068).

## Depends on / used by
- uses: src/tools/arrange (Box), src/tools/smart-guides
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers : design tools show distances between objects on screen while arranging; the page covers measurement only, not snapping (lines 34-45)
