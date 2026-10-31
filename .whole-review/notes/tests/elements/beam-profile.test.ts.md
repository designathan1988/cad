# tests/elements/beam-profile.test.ts
Lines: 37
Summary: Tests of beams: an I section has twelve points inside its width and depth; a beam whose end is set 0.6 m higher slopes, its derived tops 2.8 → 3.4 and bottom 2.4, and its 3D geometry's top at each end matches.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: section and sloping top
- 3-7 imports: vitest, newDocument, deriveGeometry, Beam/beamSection, beamKind/BeamSolid
- 9 beam helper (4 m, 15×40 cm)
- 11-20 the I section's twelve points within the bounds
- 22-35 the sloping beam: derived tops and bottom, the solid's vertex heights at x = 0 and 4 (three.js y up)
- 36 the suite closes

## Contracts, state and data flow
- Pure derivation and geometry building.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/beam/schema, src/elements/kinds/beam, three (through the solid)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/BufferAttribute.html : getX/getY return a vertex's components; count is array length / itemSize (lines 30-32)
