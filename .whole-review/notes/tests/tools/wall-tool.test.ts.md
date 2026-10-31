# tests/tools/wall-tool.test.ts
Lines: 168
Summary: Tests of the wall tool's state table, row by row, and of the snaps it uses.

Table:
- idle + click starts a chain; drawing + click makes a wall; a click on the last point is refused;
- a typed length follows the cursor's direction, and a typed angle wins;
- Enter ends the chain and keeps the walls; Esc drops only the segment in progress;
- an 8 × 6 rectangle typed in: four walls, the last closing on the start and ending the chain.

Snaps: end and midpoint within 10 px; the chain start closes; 15° steps with a 5 cm length; snaps off; Shift for right angles.

Arc mode:
- A, click, click, click bends the chord: a semicircle through (3, −3) has bulge 1;
- bulgeThrough a point (radius 5 on a chord of 8 gives −tan(asin 0.8 / 2)); a point in line gives null;
- a typed radius takes the shorter arc on the cursor's side, and one too small is refused;
- Esc while bending drops the chord.

Rectangle mode (Q):
- two corners give four walls counter-clockwise, so each faces out on its right;
- typed sides go toward the cursor from the first corner;
- a side too short is refused;
- Q again, or the arc, turns the mode off.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the table row by row and the typed 8 × 6
- 3-6 imports: vitest, vec, snap, wall-tool exports
- 8-17 run(): fold events through wallTransition, collecting segments
- 19-29 idle click → drawing, no segment; second click → one segment
- 31-33 a click on the last point is rejected
- 35-46 typed 2 toward (0, 5) → (0, 2); typed 1 at 0° → (1, 2)
- 48-54 Enter → idle with one wall; Esc keeps the made wall
- 56-69 8 × 6 typed, closing click on the start: four segments, the last ending at the origin, idle; suite closes
- 71-99 snaps at 1 cm/px: endpoint, midpoint, start (closing), angle (3, 0), none when off, Shift right angle; suite closes
- 101-113 arc mode: bend state after two clicks; the third click gives bulge 1; back to drawing
- 115-120 bulgeThrough (4, 2) on chord 8 → −tan(asin(0.8)/2); a collinear point → null
- 122-125 bulgeForRadius 5 → the same; 3 (under half the chord) → null
- 127-135 Esc while bending → drawing from the last point, no segment; suite closes
- 137-153 rect mode: first corner state; second corner → four counter-clockwise segments; idle with rect kept
- 155-159 typed 4;3 from (10, 10) toward (9, 9): first segment (6, 7)–(10, 7)
- 161-167 a zero-depth rectangle rejected; Q toggles off; the arc switches modes; suite closes (line 168 blank)

## Contracts, state and data flow
- wallTransition is a pure transition function, emitting segments that the app turns into walls. Arc bulges come from asin of half the chord over the radius, which is NaN past 1; that case is handled by returning null when the radius is below half the chord.

## Depends on / used by
- uses: src/core/vector, src/tools/snap, src/tools/wall-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/asin : asin returns [−π/2, π/2] and NaN outside [−1, 1] (lines 115-125)
- https://en.wikipedia.org/wiki/Finite-state_machine : a transition function from state and input to the next state (run and the table, lines 8-69)
