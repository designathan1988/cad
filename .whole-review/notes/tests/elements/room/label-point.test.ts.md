# tests/elements/room/label-point.test.ts
Lines: 34
Summary: Tests of where a room's name goes: labelPoint is the point inside the room farthest from its edges (the pole of inaccessibility). A 4 × 3 rectangle gives its centre, which moves when the rectangle grows. For an L, the centroid falls outside the room, so the point lies in the corner square where the 2 m arms meet, at t = 2√2/(1 + √2) ≈ 1.1716 (worked by hand). Winding does not change the result.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the point farthest from the edges, inside even for an L
- 4-5 imports: vitest and labelPoint
- 7-10 near(): each coordinate within a tolerance (default 1 cm)
- 12-15 a 4 × 3 rectangle gives (2, 1.5)
- 17-19 the 8 × 3 rectangle gives (4, 1.5)
- 21-27 the L: (1.1716, 1.1716) within 2 cm; the worked balance between the outer edges and the inner corner
- 29-33 the reversed ring gives the same centre; suite closes (line 34 blank)

## Contracts, state and data flow
- Pure geometry. The result is approximate, as in an iterative grid search with a precision, so tolerances of 1–2 cm are used.

## Depends on / used by
- uses: src/elements/room/derive (labelPoint)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://github.com/mapbox/polylabel : the pole of inaccessibility is the internal point farthest from the outline, found by a cell search to a given precision (lines 1-2, 21-27)
