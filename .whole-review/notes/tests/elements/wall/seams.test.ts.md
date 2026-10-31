# tests/elements/wall/seams.test.ts
Lines: 90
Summary: Tests of the lines drawn between layers in plan (the tester's D5). These lines mean layers do not depend on colour alone (ref/chat.txt:245); as in Revit, there is no line between pieces of the same layer and material.
- layerSeams worked by hand: two different layers sharing a side give one line; the same layer on both sides gives none; a partly shared side gives a line over the shared part only; pieces that only touch at a corner, or lie apart, give none.
- Real walls: a 4 m three-layer wall gets two 4 m lines along it. Two walls in line, the second drawn the other way, get no line across the joint.
- The solid carries its layers, for their colours.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the tester's D5, not colour alone, no line between equal layers
- 5-8 imports: vitest, the document, deriveGeometry, layerSeams
- 10-16 sq() and a seam length helper
- 18-28 finish under core sharing y 0.1: exactly one seam from (0, 0.1) to (4, 0.1), either order
- 30-35 two core pieces side by side: no seams
- 37-44 a partial shared side: the seam length is 2
- 46-53 corner-touching and distant pieces: none; suite closes
- 55-63 wall helper on its centreline
- 65-74 masonry 15: layers − 1 seams, each 4 m and horizontal
- 76-82 a and b in line with b reversed: no seam with constant x (across the joint)
- 84-89 solid.layers equals the type's layers; suite closes (line 90 blank)

## Contracts, state and data flow
- Seams are derived per wall from its pieces' shared edges, keyed by layer (function and material). They are drawn in plan beside the colours, so layers are told apart without colour alone (WCAG 1.4.1 in spirit).

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/wall/geometry/seams
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html : colour must not be the only visual means of conveying information (lines 1-3)
