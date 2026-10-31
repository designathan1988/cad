# tests/elements/wall/convex.test.ts
Lines: 94
Summary: Tests of the convex polygon helpers on a 2 × 2 square:
- clipHalfPlane keeps the whole polygon, keeps nothing, or cuts it exactly in half.
- A cut along a diagonal adds no vertices, and a cut touching one vertex repeats none.
- Near 10^6 m (UTM-size coordinates), a cut within rounding of a kept vertex still leaves no repeated vertex.
- The two sides of a cut add up to the original area.
- clipOut removes a band, leaving two pieces; removes an inner triangle, leaving three convex pieces whose areas add up exactly; and removes nothing or everything when the region misses or covers the polygon.
- toCounterClockwise reverses a clockwise ring.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 imports: vitest, vec, and area/clipHalfPlane/clipOut/halfPlaneThrough/toCounterClockwise
- 11 the 2 × 2 square, counter-clockwise
- 13-26 clipHalfPlane: inside → the same ring; outside → []; through x 1 → area 2, exact vertices
- 28-38 diagonal: triangle (0,0) (2,0) (2,2), area 2; touching one vertex: no duplicates, area 4
- 40-48 a triangle near (10^6, 10^6) cut 3e-11 from a vertex: 3 vertices, no two consecutive equal
- 50-57 both sides of a slanted cut sum to 4 (12 digits); suite closes
- 59-67 clipOut by a band x 0.5–1.5: two pieces, area 2
- 69-78 clipOut by an inner triangle of area 0.5: three pieces summing to 3.5
- 80-87 a missing region returns [square]; a covering one returns []; suite closes
- 89-93 toCounterClockwise of the reversed square is the square; suite closes (line 94 blank)

## Contracts, state and data flow
- Half-plane clipping works one edge at a time, in the style of Sutherland–Hodgman; clipOut is the complement, split into convex pieces. Exact equality is asserted where the arithmetic is exact (axis-aligned cuts).

## Depends on / used by
- uses: src/core/vector, src/elements/wall/geometry/convex
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm : clip against one edge's line at a time, keeping inside vertices and adding crossings (lines 13-57)
