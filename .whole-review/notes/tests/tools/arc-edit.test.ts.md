# tests/tools/arc-edit.test.ts
Lines: 59
Summary: Tests of editing an arc wall's curvature (from the tester's review: a selected arc had no dimension and no handle).
- bulgeFromMiddle: an arc through its two ends and a middle point gives bulge = 2s/c (sagitta over half the chord), with the sign set by the side; on the chord it is 0; only the distance off the chord counts; the sweep is capped at 340°.
- arcMiddle: the inverse of bulgeFromMiddle.
- bulgeKeepingSide: for a radius on the same side and arc kind, chord 2 with radius 1 gives ±1, and radius 2 gives tan 15° (minor) or tan 75° (major); a radius under half the chord gives null.
- straightNear (the tester's K18): a sagitta within a reach measured on screen snaps the wall straight.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the review case; bulge = 2s/c because bulge = tan(θ/4) = s/(c/2)
- 5-9 imports and the chord (0, 0)–(2, 0)
- 11-25 bulgeFromMiddle: (1, −1) → 1; (1, 1) → −1; (1, 0) → 0; (0.3, −0.5) → 0.5; (1, −100) → tan(85°) (340° cap)
- 27-33 arcMiddle for bulge 1 → (1, −1); −0.5 → y 0.5
- 35-47 bulgeKeepingSide(chord, current bulge, radius): ±1 for r 1; tan 15° for a minor current bulge; tan 75° for a major one; null for r 0.99
- 49-58 K18: snapping now measured on screen; sagitta 0.03 within 0.08 m (8 px at 100 px/m) → 0; 0.1 kept; −0.03 → 0; suite closes (line 59 blank)

## Contracts, state and data flow
- Pure arc math. The bulge follows the DXF convention: the sagitta over half the chord, equal to tan(θ/4), positive counter-clockwise. The snap reach is passed in from the view's scale.

## Depends on / used by
- uses: src/tools/arc-edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html : bulge is the sagitta over half the segment, 1 a semicircle, its sign the side (lines 2-3, 12-24)
- https://en.wikipedia.org/wiki/Sagitta_(geometry) : s = r(1 − cos θ/2), the chord relation used for radius ↔ bulge (lines 35-47)
