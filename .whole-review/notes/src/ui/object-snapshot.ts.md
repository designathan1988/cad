# src/ui/object-snapshot.ts
Lines: 112
Summary: Still 3D pictures for the stores (objects, openings, wall types, floor build-ups, presets): one shared offscreen three.js stage (filmic tone mapping, room environment, hemisphere fill, a shadow-casting key light, a shadow-only ground) made on first use; a definition evaluated at a type and pictured, or any meshes framed from a three-quarter view above, rendered at twice the size and returned as a PNG data URL (null without WebGL).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: a definition seen still in 3D; one renderer for every picture
- 5-12 imports: three, RoomEnvironment, SEE_THROUGH, previewMesh, Doc type, cutGeometries, evaluateObject, definition type
- 14-17 Stage type, the shared stage, SUPERSAMPLE 2
- 19-54 stageOf: a canvas probed for webgl2 (its context then reused by the renderer, whose options are ignored: F-0124); renderer with ACES tone mapping; environment from PMREM; hemisphere light; soft PCF shadows; the key light and its shadow settings; the shadow-only ground; group; camera
- 56-62 objectSnapshot: the definition evaluated at a type at the origin; no pieces → null; cut solids as preview meshes (see-through glass)
- 64-76 meshSnapshot: the stage; the previous picture's meshes disposed (geometry and material) and removed
- 77-87 the new meshes added and framed (box, centre, radius), casting and receiving shadows
- 88-100 the key light placed from the camera's left above; its shadow camera fitted; the ground under the meshes
- 101-111 rendered at 2× size; camera on a sphere fitting the radius; render; toDataURL in the same task

## Contracts, state and data flow
- The meshes passed belong to the stage until the next picture, which disposes them; one WebGL context for all pictures, never released.

## Depends on / used by
- uses: three, elements/material/schema, render/pattern-texture, app/document (type), elements/kinds/object, elements/object/evaluate
- used by: ui/objects-dialog.ts, ui/floors-dialog.ts, ui/opening-snapshot.ts, ui/presets-dialog.ts, ui/wall-snapshot.ts

## Problems found (finding IDs)
- F-0124 (S4): the probe's context is reused, so preserveDrawingBuffer and the renderer's options are not applied

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext : later getContext calls with the same type return the first context; attributes apply only at creation (lines 22-25, F-0124)
