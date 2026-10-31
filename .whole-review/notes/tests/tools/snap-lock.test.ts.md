# tests/tools/snap-lock.test.ts
Lines: 64
Summary: Tests of inference locks (phase 9). A lock holds the next point to a direction from the last one: an arrow's axis, a wall's line or the line square to it, or Shift's direction. The point's length falls on the grid, and the lock works both ways along its line. It stops where its line crosses a wall or a guide near the pointer, before the grid; a crossing far from the pointer is ignored. With no point drawn from there is no lock. Separately, a point the pointer rested on aligns the next points across or up from it, and draws a dashed line.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: locks and acquired points
- 5-7 imports: vitest, vec, snap/SnapInput
- 9-18 input() with mpp 0.001, from the origin
- 20-29 x-axis lock: kind 'locked', the point (3, 0) on the grid; guideFrom the origin; behind it −2.05
- 31-37 a lock square to a 30° wall: the point's component along the wall is 0
- 39-48 a wall at x 2.013 near the pointer is taken before the grid; a guide at x 1.007 too; far from the pointer the crossing is ignored (0.5)
- 50-53 from null: not locked; suite closes
- 55-63 acquired (9, 2) aligns (3.4, 2.003) to (3.4, 2), kind 'aligned', guideFrom (9, 2); without it, not aligned; suite closes (line 64 blank)

## Contracts, state and data flow
- snap is pure, taking the pointer, the scale, the segments, guides, the lock and the acquired points. A lock projects the pointer onto the lock line (a scalar projection on the unit direction) and then picks a crossing or a grid step.

## Depends on / used by
- uses: src/core/vector, src/tools/snap
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Vector_projection : the scalar projection onto a unit vector is the dot product (lines 31-37)
