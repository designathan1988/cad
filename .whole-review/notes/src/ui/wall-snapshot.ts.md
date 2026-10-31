# src/ui/wall-snapshot.ts
Lines: 35
Summary: A still 3D sample of a wall type for the types store: a 1.2 m × 1 m piece, one box per layer from the exterior (front, three.js +z) to the interior, each front layer 12 cm shorter than the one behind so the build-up shows as steps, in the layers' materials (patterns too), shot on the shared stage.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: a piece of the wall, layers stepped at the end, drawn on the objects' stage
- 5-9 imports: three, materials, WallLayer, previewMesh, meshSnapshot
- 11-14 LENGTH 1.2 m, HEIGHT 1 m, STEP 0.12 m
- 16-34 wallSnapshot: none without layers; boxes from the exterior inward, each centred box moved to start at the left end and stand on the ground; the material's preview mesh; the snapshot

## Contracts, state and data flow
- Pure but for the shared stage; with ten or more layers the front ones would reach zero length (types have a few layers).

## Depends on / used by
- uses: three, elements/material/schema, elements/wall/schema (type), render/pattern-texture, ui/object-snapshot
- used by: ui/types-dialog.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/BoxGeometry.html : BoxGeometry(width, height, depth) centred on the origin, edges along the axes (lines 26-28)
