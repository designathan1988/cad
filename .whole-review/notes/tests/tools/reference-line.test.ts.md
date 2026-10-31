# tests/tools/reference-line.test.ts
Lines: 57
Summary: Tests that choosing another reference line keeps the wall's body where it is, as in Revit and ArchiCAD: the line moves to the chosen face. For a 20 cm wall moved to its exterior face, the line goes to y −0.1 and the body still spans −0.1 to 0.1. The wall joined at its end keeps the join, its start following the line. An arc keeps its centre; its line takes the exterior face's radius (2.1) and its bulge stays the same. Choosing the same line changes nothing.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the line moves, the body stays; the walls worked by hand
- 5-8 imports: vitest, document, deriveGeometry, changeReferenceLine
- 10-23 wall helper; b along x and r up from its end; body() (the derived y extent)
- 25-35 b to exteriorFace: referenceLine set, its ends at y −0.1, the body from −0.1 to about 0.1
- 37-40 r's start follows to y −0.1
- 42-51 a half-circle arc of radius 2: its ends at radius 2.1 from (2, 0), bulge still 1
- 53-56 the same line again: walls equal; suite closes (line 57 blank)

## Contracts, state and data flow
- changeReferenceLine returns a new wall list. The ends move by the offset between the old and new lines, the joined ends follow, and an arc's line becomes a concentric circle.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/tools/edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Parallel_curve : a circle's parallel curve is a concentric circle of radius R + d (lines 42-51)
