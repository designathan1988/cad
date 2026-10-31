# tests/render/wall-paint.test.ts
Lines: 33
Summary: Tests of what colours a wall block in 3D (the tester's D5).
- A block takes its layer's material on its sides and top, as in plan.
- Selection and the preview cover the layer colours.
- With no layer known (type missing), the plain wall colours are used.
- wallMeshKey changes when only a layer's material changes, so the colours follow a type edit, and it is stable for the same input.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: layer material like the plan; selection and preview over it; plain when the type is missing
- 4-6 imports: vitest, BUILT_IN_MATERIALS, blockPaint/wallMeshKey
- 8-10 plaster and brick from the built-ins
- 12-16 layer 0 → plaster, layer 1 → brick, on side and top
- 17-20 's' → sideSel/topSel; 'p' → preview
- 21-24 no materials → side/top; suite closes
- 26-32 the key differs when the materials list differs and is equal for the same list; suite closes (line 33 blank)

## Contracts, state and data flow
- blockPaint returns either a material or a named shared paint. wallMeshKey includes the layer materials, so a type edit rebuilds the cached mesh. Shared three.js materials are reused across meshes.

## Depends on / used by
- uses: src/elements/material/schema, src/render/wall-paint
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/Material.html : materials can be shared across meshes; needsUpdate flags a recompile (the shared paints, lines 17-23)
