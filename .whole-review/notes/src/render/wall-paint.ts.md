# src/render/wall-paint.ts
Lines: 21
Summary: Pure helpers for the 3D walls: which paint each block of a wall gets (the preview or selection materials over everything, else its layer's project material, else the plain wall colours when the type is missing), and the key that decides when a wall's meshes are rebuilt.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: block colours from the layer's material, as in plan and swatches; selection/preview over layers; plain colours with no type
- 5-6 imports: Block (opening/void) and Material types
- 8-9 Paint: one of the scene's named materials or a project material
- 11-16 blockPaint: state p → preview, s → selection side/top, else the layer's material on both, or side/top when there is none
- 18-20 wallMeshKey: state + JSON of the blocks + JSON of the material ids (a material's colour change does not change the key; scene-3d refreshes layer materials apart)

## Contracts, state and data flow
- Pure. The key is a full JSON of the wall's blocks per sync (part of the per-sync JSON cost already noted in scene-3d).

## Depends on / used by
- uses: elements/opening/void (Block type), elements/material/schema (Material type)
- used by: render/scene-3d.ts (wall sync 1257-1290 and build 1408-1420)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : key order is deterministic (Object.keys order), so the key is stable for equal blocks built the same way; NaN becomes null (lines 18-20)
