# tests/elements/wall/arc-corner.test.ts
Lines: 174
Summary: Tests of L joins between an arc wall and a straight wall, checked densely against the spec's own corner (an oracle in oracle-arc.ts), by sampling points near the node: no overlap, no gap, no extra. Cases:
- the recorded open defect: a 1 cm arc with a 1 cm wall at ±30°, for all 9 reference-line combinations on both sides;
- a butt L at an arc end where the straight wall's body reaches past the end segment (thick walls from the property suite);
- four found candidates whose far end also lies within 1 mm of the arc, making a second T junction; both joins are exact, and with the end pulled back 5 mm the L alone is exact;
- an L whose corner reaches past the arc's end segment, which is allowed because the arc continues (88 segments, walls 40 and 60 cm, at 100° and 140°); under the old rule the same corner is refused;
- corners that pass a real free end (the arc's other end, or the wall's far end) are not joined and are warned wallsOverlap.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the open defect from docs/wall-joins-spec.md part 6, and how it is checked
- 6-12 imports: vitest, fixtures (geometry, layer, testWall), the arc oracle helpers, inside/rectOf, cornerJoin; the three reference lines
- 14-33 thin arc (bulge 0.0437) and thin wall at ±30° for every arc/wall reference: no warnings; arcCorner not 'overlap'; 20 seeded coverage runs within 0.2 m with 0 overlaps, gaps and extras
- 35-56 the butt L with thick walls (random-looking coordinates from the property suite): no warnings, not touching the arc elsewhere, 10 coverage runs exact
- 58-74 the three arcs and four two-junction candidates (start or end, thick or thin abutting)
- 76-122 for each candidate: far end within 1 mm of the arc; no warnings; a 3000-point golden-angle spiral (2.399963 rad) over a disc checks the L at the node (0.6 m) and the T at the far end (0.5 m, arc body, the wall less what is beyond, the T fill); the 5 mm pulled-back control is exact with coverage
- 124-133 a long arc (6 m chord, bulge −1, 20 cm thick) and a leaving wall at a given angle and thickness
- 135-157 for 40 and 60 cm at 100° and 140°: joined exactly (coverage with tBeyond); control: 88 segments of 10.7 cm, cornerJoin on the end segment alone gives 'overlap', and 'miter' when a far reach is allowed
- 159-173 a 10 cm arc (5 segments) with a 50 cm wall, and a 30 cm wall 60 cm thick on the long arc: arcCorner 'overlap', warning wallsOverlap; suite closes (line 174 blank)

## Contracts, state and data flow
- The test compares the engine (geometry) with independent oracles (oracle, oracle-arc, oracle-x) by point sampling. Sampling uses deterministic seeds and the golden-angle spiral, so a failure is reproducible.

## Depends on / used by
- uses: tests/elements/wall/fixtures, oracle-arc, oracle, oracle-x (test oracles), and through them src/elements/wall/geometry
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Golden_angle : the golden angle is π(3 − √5) ≈ 2.39996 rad, used for even sunflower-like spreading (line 87)
