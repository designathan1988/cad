# tests/tools/split.test.ts
Lines: 94
Summary: Tests of dividing, joining and cornering walls, by hand, on a 4 m wall with a 0.90 m door 2.5 m from its start.
- Divide at the foot of the point: the first part keeps the id; the door goes to its part at the same place (fromStart 1); the parts tile the old body; the other walls keep their numbers; a split through the door or too near an end is refused; a half-circle arc cut at its middle gives two quarter arcs.
- Join the two parts back: the wall it was, with the door at 2.5. Walls not in line, not end to end, or of different types are refused.
- Corner: two walls that do not meet are both taken to where their lines cross. Exactly parallel walls have no corner.
- Not covered: end joins, neighbours or dimensions on a split or merged wall (F-0106), and nearly parallel walls cornered far away (F-0101 Also).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the wall and door worked by hand
- 4-8 imports: vitest, document (wallNumber), geometry, newOpening, the split functions
- 10-21 wall helper with bulge; the doc; area() (sum of piece shoelace areas)
- 23-31 split at (1.5, 0.03): b (0–1.5) and wall_2 (1.5–4)
- 33-37 the door on wall_2 at fromStart 1, derived start 1
- 39-42 equal area and no warnings
- 44-48 a and c keep numbers 1 and 2; wall_2 is 3
- 50-53 'throughOpening' at 2.8; 'tooShort' at 0.005
- 55-63 arc bulge 1 split at its middle: the first part ends at (2, −2); both bulges tan(π/8); suite closes
- 65-72 merge back: walls equal the original; the door on b at 2.5
- 74-79 an L pair and a gapped pair: canMerge false; suite closes
- 81-87 a (0–3 on y 0) and c (x 4, y 1–4) cornered at (4, 0)
- 89-93 parallel walls: null; suite closes (line 94 blank)

## Contracts, state and data flow
- splitWall returns a new document or a refusal reason; mergeWalls and cornerWalls return new data or null. Openings are re-hosted with their stations shifted, but per-end data (joins, dimension anchors) is not (F-0106). cornerWalls stretches both walls to intersectLines' point, which has no near-parallel guard.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening/schema, src/tools/split
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0106 (Also: not covered); F-0101 (Also: cornerWalls near-parallel)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tan : tan takes radians (the quarter-arc bulge tan(π/8), lines 60-61)
- https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection : the zero denominator for parallel lines and the far point for nearly parallel ones (cornerWalls, lines 81-92)
