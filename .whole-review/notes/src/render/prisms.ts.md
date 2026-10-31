# src/render/prisms.ts
Lines: 294
Summary: three.js geometry for the 3D view: wall blocks with only their visible faces (flat or sloped top under a roof), plain prisms, floor slabs with holes and slope, stairs and ramps with handrail ribbons, roofs (faces as slabs with gable infills and parapets) and guardrails (posts, top and mid rails, balusters or glass). World (x, y, height) maps to three (x, height, −y).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: for the 3D view "and for the export (export-gltf.ts)" (removed: F-0047 Also); axis mapping
- 4-9 imports and toThree: three, Point2, PrismFaces, planeAt and TopPlane
- 11-39 shownPrism: only the visible side rectangles (faces.ts), visible top and bottom parts; sides group 0, caps group 1; flat normals
- 41-75 slopedPrism: sides cut under the top plane, the top on the plane, bottom parts; same groups
- 77-102 prism: a convex ccw polygon extruded; sides and caps (the `export` keyword stands before the doc comment)
- 104-120 slabGeometry: Shape with hole paths extruded by the thickness; each vertex raised by the slope
- 122-169 stairGeometry: each part a solid from 0 (or a thin tread) up to its top (a ramp's sloped); handrails as 5 cm ribbons and end posts 0.9 m long (a literal: F-0084 Also)
- 171-209 roofGeometry: each face a slab its thickness square to the slope (taller upright by √(1+g²)), gables fanned, parapets as slabs
- 211-246 railingGeometry setup: square bars along segments, posts with feet that rise along a stair
- 247-284 per segment: top rail; mid rail; or a bottom rail and balusters every spacing; or a glass pane both faces between posts
- 285-293 frame and glass geometries

## Contracts, state and data flow
- Pure geometry builders; callers own disposal (three: dispose() frees GPU memory). Non-indexed with computeVertexNormals → flat shading.

## Depends on / used by
- uses: three, core/vector (type), wall/geometry/faces (type), wall/geometry/under-roof
- used by: render/scene-3d.ts and the kinds' 3D (walls, floors, stairs, roofs, railings)

## Problems found (finding IDs)
- F-0047 (Also): export comment
- F-0084 (Also): handrail posts' 0.9 m literal

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/BufferGeometry.html : computeVertexNormals gives face normals on non-indexed geometry; addGroup ranges for material arrays; dispose frees GPU resources (lines 33-37, 69-74)
