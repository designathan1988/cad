# tests/io/model-import.test.ts
Lines: 68
Summary: Tests of importing a 3D model as a parametric object (phase 11). The mesh is normalised into a unit box and stretched by width, depth and height parameters.
- The plan hull of a square plus an interior point has 4 corners.
- A two-mesh box given in centimetres: the unit is read as 0.01; there are 24 triangles; the width, depth and height defaults are 0.8, 0.4 and 1.2 m; one material is made per colour, with one part per mesh; positions lie in [0, 1]; the definition is valid, but not without its meshes.
- Placed with a width of 2, its plan outline spans 2 m about its point, and it has 5 handles.
- No triangles gives null.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a model as a parametric object in a unit box
- 4-8 imports: vitest, newDocument, evaluateObject/pieceOutline, isDefinition, hull/meshDefinition
- 10-24 box(): a box's 12 triangles as a flat array, scaled and moved by ox
- 26-30 an id generator (prefix_n)
- 32-34 hull of a square plus its centre: 4 points
- 36-50 'Armário' from two boxes in cm: unit 0.01; 24 triangles; parameters largura 0.8, profundidade 0.4, altura 1.2; two colours become two materials; two parts; mesh positions in the unit box; valid; invalid with meshes []
- 52-62 'Caixa' 1 × 1 × 1 placed at (5, 5) with largura 2: no problems, one piece, x from 4 to 6, 5 handles
- 64-67 empty positions return null; suite closes (line 68 blank)

## Contracts, state and data flow
- meshDefinition is pure. It guesses the unit from the model's size, normalises the positions, and builds a definition with materials and size parameters. hull gives the plan outline.

## Depends on / used by
- uses: src/app/document, src/elements/object (evaluate, valid), src/io/import-mesh
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Convex_hull_algorithms : planar hull algorithms such as Andrew's monotone chain, O(n log n) (hull, line 33)
