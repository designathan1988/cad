# tests/tools/arrange.test.ts
Lines: 62
Summary: Tests of aligning and distributing any selection (phase 9), given as the step each box takes.
- Align: to the selection's left, right or horizontal centre, nothing moves vertically; to the bottom, top or vertical middle, nothing moves horizontally. A single box does not move.
- Distribute: equal gaps between the boxes, with the first and last staying put, whatever order they were picked in. This works horizontally and vertically; two boxes have nothing to distribute.
- boxOf: the box around a set of points, or null for none.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: align and distribute any selection
- 3-7 imports and helpers: box, moved (a box shifted by a step)
- 9-20 three boxes: left → min x 0 (y unchanged); right → max x 5; centreX → 2.5
- 22-30 top → max y 7 (x unchanged); bottom → min y 0; centreY → 3.5
- 32-35 one box: step (0, 0); suite closes
- 37-48 four boxes picked out of order: the outer ones stay (12 and 0); three gaps of 2 m; y unchanged
- 50-55 spreadY: the middle box goes to 4.5; two boxes: zero steps
- 57-61 boxOf of two points; [] gives null; suite closes (line 62 blank)

## Contracts, state and data flow
- Pure: arrangeSteps returns a step per box, which the caller applies with its own moves. boxOf spreads its points into Math.min/max (F-0100: engine argument limits for very large selections; this test uses two points).

## Depends on / used by
- uses: src/tools/arrange
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (boxOf's spread: F-0100)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : spreading into a call can exceed the engine's argument length limit (boxOf, lines 57-60)
