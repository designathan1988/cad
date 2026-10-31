# tests/elements/object-profile.test.ts
Lines: 171
Summary: Tests of object part shapes:
- An L-counter profile: corners are formulas of its parameters; it is extruded with outward faces, so its volume is positive; its bounds are correct; a wider arm keeps the shape's relations.
- A revolve of a rectangle: a cylinder with roundSides(r) sides, the right volume, height and round plan outline.
- A box tilted 90° lies on its back. A box rolled 30° leans toward +x.
- A cylinder tilted 90° lies along +y as a rail.
- Parts turned in plan: a box turns about its base's centre; a lying cylinder points along −x.
- An ellipsoid with its own y radius, turned.
- A profile drawn clockwise is reversed, so its volume is still positive.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: profile corners as formulas, extruded, plan outline the polygon
- 3-9 imports: three, vitest, newDocument, pieceGeometry/roundSides, evaluateObject/pieceOutline/pieceSpan, ObjectDefinition, isDefinition
- 11-41 the L counter definition: parameters largura, lado, fundo; a six-corner profile at z 0.87 with h 0.03
- 43-55 signed volume by the divergence theorem (no abs), so the sign checks the face winding
- 57-65 place helper; the definition is valid; a two-corner profile is not
- 67-83 six outline corners; volume (2·0.6 + 0.6·0.9)·0.03 to 6 digits (32-bit positions); three.js y from 0.87 to 0.9; z from −1.5 to 0 (plan y is −z); fundo 0.7 changes the volume as expected
- 85-95 revolve: |volume| = n/2·r²·sin(2π/n)·h with n = roundSides(0.2); y from 0.1 to 1.1; outline on the 0.2 circle
- 97-117 box tilted 90° about its base's front edge: outline 0..1 × 0..1, span 0.4..0.5, three.js bounds; a leg rolled 30°: top at x 0.05·cos30° + sin30°, y cos30°
- 119-131 cylinder tilted 90°: outline y 0..0.6, span 0.98..1.02, bounds in three.js axes
- 133-151 turn 90°: the box spans 0.4..0.6 × −0.4..0.6 about its centre (0.5, 0.1); the lying cylinder runs from x −0.4 to 0
- 153-163 an ellipsoid turned a quarter: 0.2 along x, 0.05 along y, span 1..1.01
- 165-170 the clockwise profile (points reversed) still gives a positive volume; suite closes (line 171 blank)

## Contracts, state and data flow
- Pure evaluation and geometry. Plan (x, y) maps to three.js (x, −z), with height on y. Adding `+ 0` turns −0 into 0 before toEqual; Box3 bounds come from the position attribute.

## Depends on / used by
- uses: three, src/app/document, src/elements/kinds/object, src/elements/object (evaluate, schema, valid)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/Box3.html : setFromBufferAttribute sets the box to enclose every position in the attribute (lines 76, 92, 109, 114, 128)
