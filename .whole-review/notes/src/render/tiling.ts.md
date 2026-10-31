# src/render/tiling.ts
Lines: 85
Summary: The joints of a floor's laid finish in plan, in the tiling's own frame turned about the floor's first corner. It covers grid, running bond (rows shifted half a piece), checkerboard (shaded squares) and herringbone (zigzag rows at 45°), over the floor's box (the plan clips them). Nothing is drawn past 4,000 pieces.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: joints over the floor's box in the tiling's frame; the plan clips; four patterns
- 6-7 imports: Point2 and Tiling types
- 9-13 TilingDrawing: lines and shaded pieces
- 15-16 MOST 4000: past it nothing is drawn (too fine)
- 18-35 tilingDrawing setup: the frame (u along the angle, v across) at the first corner; the floor's extent in it; piece plus joint sizes; world()
- 36-58 herringbone: zigzag rows at 45° a piece's width apart, and short lines across each leg for the pieces' ends
- 59-65 grid: whole pieces from a multiple of the size; the row lines
- 66-73 running bond: column lines shifted half a piece every other row; else straight column lines
- 74-84 checkerboard: every other cell shaded (parity offset by the start cell)

## Contracts, state and data flow
- Pure. Over the limit it returns nothing, silently.

## Depends on / used by
- uses: core/vector (type), room/schema (Tiling type)
- used by: elements/kinds/floor.ts (plan drawing of tiled floors)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Herringbone_pattern : rectangular blocks (usually 2:1) laid parallel or 45° rotated in zigzag rows (lines 36-58)
