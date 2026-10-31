# tests/elements/reference.test.ts
Lines: 131
Summary: Tests of reference drawings under the plan (phase 11).

An image reference:
- points follow its corner, unit scale and turn;
- calibrating two points to a real distance scales about the first point, refusing coincident points and a zero distance;
- a quarter turn rotates its corner and adds to its angle;
- picked inside, not outside;
- validated: a non-image data URL, opacity 0 or bad DXF lines are refused, and commands refuse an out-of-range opacity;
- kept by a file round trip; a version-31 file reads with none.

A DXF read as lines:
- a LINE, a closed LWPOLYLINE and a CIRCLE in millimetres by $INSUNITS 4, moved to their lowest corner;
- TEXT counted as skipped;
- with no units, house-size drawings are read as metres and kilometre-size ones as millimetres;
- an ARC from 0° to 90° becomes nine 10° segments on the circle.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: placed, turned, scaled, calibrated, DXF in metres, kept in the file
- 4-11 imports: vitest, document, referenceKind, commands, schema helpers, readDxfLines, project file, rotation
- 13-22 a 1000 × 500 px image at (2, 1), 1 cm per pixel, opacity 0.5
- 24-37 referencePoint (1000, 500) → (12, 6); turned a quarter → (2, 2); corners
- 39-51 calibrated: 2 m to 5 m gives scale 0.025, a stays, b at 5 m; null for a = b or 0 m
- 53-59 mapped by a quarter rotation about the origin: at (−1, 2), angle π/2, scale kept
- 61-64 hit inside at (5, 3), not at (13, 3)
- 66-74 isReference refuses javascript: data, opacity 0, DXF lines of odd length; updateReferences refuses opacity 2 (same doc) and accepts 0.8
- 76-83 write/read keeps it; version 31 with no references reads as []; suite closes
- 85-98 dxf(): builds group-code/value pairs with an optional HEADER $INSUNITS, joined with CRLF
- 100-118 mm drawing: unit 0.001, 40 segments (1 + 3 + 36), origin (1, 1), w 4, h 2.5, the first line [0, 1, 4, 1], skipped {TEXT: 1}
- 120-123 no units: 12 → metres, 12000 → millimetres
- 125-130 ARC 0–90° r 1 in metres: 9 segments, each point on the unit circle; suite closes (line 131 blank)

## Contracts, state and data flow
- A reference is plain data: an image or DXF lines with origin and scale. DXF lines are stored as a flat [x0, y0, x1, y1, …] array, relative to the drawing's lowest corner.
- The polyline case has no bulges and there is no ELLIPSE case, so this test does not see F-0092 (arcs inside polylines lost, ellipses skipped).

## Depends on / used by
- uses: src/app/document, src/elements/kinds/reference, src/elements/reference (commands, schema), src/io/import-dxf, src/io/project-file, src/tools/transform
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0092 untested here)

## To check in other files
- none

## Sources
- https://ezdxf.readthedocs.io/en/stable/concepts/units.html : $INSUNITS 4 is millimetres, 6 metres, 0 unitless (lines 103, 121-122, 126)
