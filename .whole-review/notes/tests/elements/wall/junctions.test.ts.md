# tests/elements/wall/junctions.test.ts
Lines: 255
Summary: Tests of junctions (spec §7.6), checked two ways that share nothing with the engine: sampled coverage against the union of the bands (crossings only), and the polyclip union of the pieces, which must be one ring with no hole whose vertices near the junction are exactly the hand-worked corners of the facing faces. Cases:
- three walls crossing at one point: six arms; the 45° gaps meet on their bisectors and the 90° gaps are square;
- three walls crossing a few centimetres apart (drawn by hand): joined as one junction, squaring the sliver corner;
- a wall ending on a crossing;
- a wall ending inside an L's corner from outside it;
- a Y of unlike thicknesses: its lines start from the middle of the corners, so the faces meet with no bare core and no step.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: §7.6 and the two independent checks
- 8-15 imports: vitest, polyclip-ts (setPrecision 1e-9, union), vec, overlapArea, fixtures, oracle helpers
- 17-40 small vector helpers (dir, ccwNormal, neg); facesMeet (Cramer's rule for two face lines); corner() (where arm a's ccw face meets arm b's cw face)
- 42-51 piecesOf; expectNoOverlap (pairwise overlapArea < 1e-9)
- 53-69 outlineNear: one ring, no hole, its vertices within a radius; expectVertices to 1e-7
- 71-97 edgesOf; bandsRegion (the union of the bands less an optional triangle, area from polyclip with holes subtracted); expectBands (sampled overlaps, gaps and extras all 0, area error < 1e-9)
- 99-126 three walls through the origin: no warnings, each split in two; exact bands; six outline vertices (bisector corners at 0.05/sin 22.5°, square ones)
- 128-167 the 45° wall 6 cm off: one junction, no warnings; bands less the sliver triangle; six face corners, no stubs
- 169-200 a wall ending on the crossing: a and b split, c whole; exact; five outline vertices
- 202-225 c ending 1 cm inside an L's corner: no warnings, no overlap; three outline vertices
- 227-254 the Y (25, 15 and 10 cm): one piece each, no overlap; the three face corners via corner(); suite closes (line 255 blank)

## Contracts, state and data flow
- The engine's junction pieces must tile the walls' bands (at crossings) and leave only face-corner vertices near the node. facesMeet divides by the determinant with no guard, which is safe here because the arms tested are never parallel.

## Depends on / used by
- uses: polyclip-ts, src/core/vector, src/elements/wall/geometry/convex, tests/elements/wall/fixtures, oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Cramer%27s_rule : the 2×2 solution and its failure at a zero determinant (facesMeet, lines 24-28)
