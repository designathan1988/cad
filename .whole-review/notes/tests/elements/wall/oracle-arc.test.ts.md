# tests/elements/wall/oracle-arc.test.ts
Lines: 127
Summary: Tests of the arc oracle's own helpers against hand-worked cases, so the oracle the property suites trust is itself checked:
- sharedArea: offset squares; disjoint squares; either winding.
- touchesArcElsewhere: a wall through the arc's middle touches it; one that stays above does not.
- segmentWall: the first segment starts at the arc's start, ends on the circle and is slightly thinner.
- distanceToSegments: 0 on the arc; ≈ 1.07289 to the end segments' inner corners, with 51 segments; under 1 mm just outside the outer face, within the 0.5 mm sag.
- tFill: fills the gap between a square end and the curved face, but not the arc's body, not behind the end, not outside the wall's width, and not across the ring.
- tBeyond: what of the abutting wall lies past the arc.
- cornerReach: for the right-angle L, 0.1 + 0.1·tan(Δ/2), with 88 segments.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the oracle's helpers against hand cases
- 3-5 imports: vitest, fixtures, the eight oracle-arc helpers
- 7-12 sq(): an axis-aligned square ring
- 14-26 sharedArea: 1 for offset 2 m squares; 0 for apart; 1 for the unit square in a clockwise triangle, either order
- 28-38 a half circle (bulge 1, r 1): the wall from (2, −2) touches; from (0, 2) does not
- 40-50 segmentWall 0: starts at (0, 0), ends on the circle below y 0, thickness between 0.0999 and 0.1
- 51-59 (1, −1) at distance 0; 51 segments; (1, 0.5) at 1.07289 (the end's tilted corner worked out)
- 60-67 a point 0.5 mm past the outer face is between 0 and 1 mm from the segments (the sag)
- 69-86 tFill for a 45° wall ending at (3, 3.05) on a 6 m ring of 20 cm: true at (2.94, 3.1); false in the band, behind the end, or outside the width
- 88-96 a horizontal wall ending inside the band: its band crossing the ring is not filled on the far side
- 98-113 tBeyond for a 45° wall from inside: (2.935, 3.1) is beyond; (2.95, 3.0) and (2.5, 2.55) are not
- 115-126 cornerReach for the right-angle L equals 0.1 + 0.1·tan(π/176), with 88 segments; suite closes (line 127 blank)

## Contracts, state and data flow
- The oracle approximates the arc by chords whose sag stays within the spec's 0.5 mm, so distances near the faces are tested with a 1 mm tolerance.

## Depends on / used by
- uses: tests/elements/wall/fixtures, tests/elements/wall/oracle-arc
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Sagitta_(geometry) : a chord's sag is s = r(1 − cos θ), ≈ l²/8r for small s (lines 60-66)
