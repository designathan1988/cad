# tests/elements/wall/nodes.test.ts
Lines: 220
Summary: Tests of wall nodes with 3, 4 and 5 or more ends (spec §7.4, §7.6), every value worked by hand.
- 3 ends, two of them in line: the passage is cut at x = 0; the third wall abuts as a T, layer by layer, and notches both passage walls.
- 4 ends: a second stem abuts from below and notches the passage's finish 1.
- 3 ends with no pair in line: each arm takes its sector, cut on the lines from the middle of the three face corners (the centroid, inside all three walls) to its two corners. No overlap.
- 5 ends 72° apart: each arm is cut from the node to the bisector corners. These were once refused with complexJoin.
- An end across a step between unlike passage walls: it takes its sector, with corners above and the step below; areas add up.
- An arc leaving the outside of an L corner (a curved porch): no warning, no overlap with the corner walls, and it starts on their outer faces.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: spec §7.4 and §7.6, values by hand
- 4-8 imports: vitest, vec, fixtures, shoelace, overlapArea
- 10-19 XY and expectPolygon (vertex set to 1e-12)
- 21-24 the plastered (2 + 15 + 3) and thin (1 + 10 + 1) stacks and their bands
- 26-61 3 ends: no warnings; a and b cores split at x = 0; c's core and finish 1 to y 0.07, finish 2 to 0.1; a's and b's finish 2 notched at −0.05 and 0.06; area 1.6 + 0.12·2.9
- 63-91 4 ends: d abuts from below (core to −0.08, finish 1 to −0.1); the passage's finish 1 notched within ±0.05; area 1.6 + 2·0.12·2.9
- 93-118 3 ends with no pair in line (30 cm at 0°, 30 cm at 160°, 10 cm at 30°): the face corners ac, cb and ba worked out, and their middle
- 120-139 one piece each; each polygon cut through the middle point; no pairwise overlap
- 141-164 five 10 cm walls 72° apart: each a pentagon from the node to the bisector corners at 0.05/sin 36° and its far end; no overlaps
- 166-186 20 cm and 30 cm in line with a 10 cm stem across the step: the three polygons; area 0.8 + 1.2 + (0.3 − 0.005 − 0.0075)
- 188-201 a 10 × 8 house with 26.5 cm walls and an arc (bulge −0.6495, 15 cm) from the outer corner (10, 8)
- 203-218 no warnings; no arc piece overlaps w1 or w2; no arc vertex inside both outer faces; some arc vertex on one of them; suite closes (line 219; 220 blank)

## Contracts, state and data flow
- At a node with no pair in line, sectors start from the mean of the face corners. A triangle's centroid always lies inside it, which is why "the middle lies inside all three walls" holds. These cases are the static side of the reported break "wall gone at a 3-end node"; what the app did there is decided in verify/apptest.

## Depends on / used by
- uses: src/core/vector, src/elements/wall/geometry/convex, tests/elements/wall/fixtures, oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Centroid : a triangle's centroid is the mean of its vertices and lies inside it (line 118, the middle of the three corners)
