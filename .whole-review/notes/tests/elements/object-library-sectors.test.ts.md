# tests/elements/object-library-sectors.test.ts
Lines: 98
Summary: Tests of the sector families (children, commerce, health, school): every numeric parameter at its min and max in every type closes, draws and stays on the floor; a gondola of more than 150 pieces merges into one geometry per material with the same triangle count; a house bed asked 1 cm high keeps its least height 1.3 and loses nothing; the toy chest lid lies on the box when closed and stands from the back edge at 90°; the mobile whiteboard's four castors stand under its feet and the wall type has fewer pieces.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: sector families at range ends, the toy chest hinge, the whiteboard castors
- 5-12 imports: vitest, materials, evaluate helpers (boxCorners, pieceSpan), LIBRARY, three, byMaterial/cutGeometries, five sector definitions, ObjectDefinition
- 14-18 helpers: context, `at` evaluates a type with values, `low` (lowest solid bottom), `tilted` (the lacquerSage boxes wider than 0.5, the lid)
- 20-37 per sector family, per plain numeric parameter at min and max, per type: no problems, pieces, lowest point above −0.005
- 39-51 the gondola: cutGeometries then byMaterial gives one geometry per material and keeps every triangle
- 53-60 a house bed at altura 0.01 is clamped to 1.3, loses nothing, stays on the floor
- 62-81 the toy chest lid: closed spans y ±0.21 with top 0.45; at 90° it stands behind 0.18, above 0.42, up to 0.87 (line 73 relies on the type's default lid material being lacquerSage)
- 83-97 the whiteboard: lowest 0, four spheres each within a 4 cm-high foot's footprint (+3 cm in x); the wall type has fewer pieces; suite closes (line 98 blank)

## Contracts, state and data flow
- Pure evaluation and geometry. byMaterial merges per material; a merge requires compatible attributes (all indexed or all not).

## Depends on / used by
- uses: three, src/elements/material/schema, src/elements/object (evaluate, library, library-sectors, schema), src/elements/kinds/object
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/module-BufferGeometryUtils.html : mergeGeometries needs compatible attributes and returns null when it fails (lines 42-49, byMaterial)
