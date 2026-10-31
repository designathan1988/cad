# tests/elements/wall/arcs.test.ts
Lines: 329
Summary: Hand-worked tests of arc walls (spec §5.2). The segment count is the spec's own formula; every other value is computed from circles and chords. Cases:
- A lone semicircle: the spec's n trapezoids with every vertex on its two face circles; the exact trapezoid area; radial free ends; a negative bulge bulges the other way; layers on their own circles; a radius below the face offset gives arcTooTight and nothing drawn.
- An arc joined in line with straight walls at both ends (L at 180°): no warning, square cuts, the area adds up.
- An arc and a straight wall at 90°: the miter's exact vertices.
- Ts against an arc, checked strictly by 4000 spiral samples: a wall wider than one chord abutting from inside; a wall ending on an arc joint; a thin slanted wall found by the property suite; from the convex side; layered at a slant, where layers stop by priority on the core or outer face; a wall reaching past the arc's end; a narrow wall meeting one chord, whose end lies on that chord.
- An arc ending against a plastered straight wall for four bulges: no warning, nothing past the core face, and the pieces tile one outline with no hole (polyclip union area = sum of areas).
- Xs: a thin wall across a thick arc (the arc passes); a thick wall across a thin arc (the wall passes); a slanted layered crossing.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: spec §5.2; the count by the spec's formula, all else by hand
- 4-12 imports: vitest, vec, LAYER_PRIORITY/WallLayer, fixtures, oracle, oracle-arc, polyclip-ts (setPrecision 1e-9 for the union check)
- 14-21 nearSide (the same helper as in arcs.property.test.ts, copied)
- 23-31 SPEC_ARC_SAG 0.5 mm and segmentsFor (the spec's count: ceil(|sweep| / (2·acos(1 − sag/rMax)))); the arc builder; a plastered three-layer stack
- 33-52 the semicircle (0,0)→(6,0), bulge 1, 20 cm: no warnings, n pieces, every vertex on r 2.9 or 3.1, below y = 0
- 54-62 the area n·(3.1² − 2.9²)/2·sin(π/n); free ends radial at x −0.1, 0.1, 5.9, 6.1
- 64-81 bulge −1 above y = 0; plastered layers on radii 3.1, 3.08, 2.93, 2.9; 3n pieces
- 83-91 a 5 cm radius quarter with a 20 cm wall: arcTooTight, no pieces
- 93-117 the arc with walls from y −4 at both ends: no warnings, left wall from −4 to 0, total area 1.6 + the arc's
- 119-140 arc and wall at 90°: miter vertices (0.1 − 0.1·tan(Δ/2), −0.1) and (−0.1 + 0.1·tan(Δ/2), 0.1) to 1e-12
- 142-169 strictT: 4000 golden-angle samples around the end compare piece counts with the oracle (arc bodies, the wall less what is beyond, the T fill)
- 171-205 a 30 cm wall from inside stays within r 2.9; a wall ending on the joint at (3, 3); the slanted thin wall from the property suite; from outside: all exact
- 207-236 plastered T at 60°: exact; each layer's deepest point lies between the face it stops at (core face if it passes the outer finish by priority, else the outer face) times cos(Δ/2) and that face
- 238-258 a 60 cm wall past the arc's end: exact; a 4 cm wall along a segment's middle radial reaches exactly 2.9·cos(Δ/2)
- 260-286 an arc ending against the plastered host x = 5, for bulges 0.3, 0.5, −0.3 and 1: no warnings, x ≤ 4.93, union is one ring with no hole and area = sum
- 288-303 strictX: 4000 samples, one piece inside either body, none outside
- 305-320 a 10 cm wall across the 20 cm arc: exact, nothing of the wall within the arc's band; a 30 cm wall across a 10 cm arc: nothing of the arc within x 2.85–3.15
- 322-328 slanted layered crossing: exact; suite closes (line 329 blank)

## Contracts, state and data flow
- The engine's pieces are compared with the spec's construction. polyclip-ts union is used only as an independent tiling check. setPrecision changes the library's module state, which Vitest isolates per test file.

## Depends on / used by
- uses: src/core/vector, src/elements/wall/schema, tests/elements/wall/fixtures, oracle, oracle-arc, polyclip-ts
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none (nearSide is duplicated in arcs.property.test.ts:236-243, a test-only copy)

## To check in other files
- none

## Sources
- https://github.com/luizbarboza/polyclip-ts : union takes Polygons or MultiPolygons and returns a MultiPolygon of non-overlapping polygons (lines 278-283)
