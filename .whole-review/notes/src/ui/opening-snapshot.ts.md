# src/ui/opening-snapshot.ts
Lines: 65
Summary: A still 3D picture of a door or window model for the doors and windows store: a temporary opening of the model (open 35% when unset) in a piece of 18 cm wall with 50 cm margins and a floor, its parts from opening/parts.ts turned about their hinges, in the model's own built-in materials or default looks, shot on the shared stage from the front at three-quarters.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: a model in a piece of wall, three-quarter view, drawn on the objects' stage
- 5-13 imports: three, Point2, openingParts, newOpening, OpeningModel, prism, meshSnapshot, materials, previewMesh
- 15-17 MARGIN 0.5 m and THICK 0.18 m
- 19-20 look: a standard material with colour, roughness, metalness, optional opacity
- 22-29 openingSnapshot setup: span, sill and head, a straight frame along x, a temporary opening of the model (open 0.35 by default)
- 30-41 the wall blocks: each side, over the head, under a sill
- 42-43 a floor slab under it
- 44-51 each part as a prism, rotated about its turn axis (plan → three axes: x, z up, −y) by translate–rotate–translate
- 52-61 materials: the model's leaf/frame material or frosted glass from the built-in list only (materialIn with no project materials), else glass/leaf/frame defaults
- 62-64 the snapshot from the front (yaw 0.62, pitch 0.3)

## Contracts, state and data flow
- Pure but for the shared stage; meshes handed over to meshSnapshot, which disposes them at the next picture.
- Project-defined materials named by a model show the fallback look (only built-in materials are looked up).

## Depends on / used by
- uses: three, core/vector, elements/opening (parts, schema, style), render/prisms, ui/object-snapshot, elements/material/schema, render/pattern-texture
- used by: ui/openings-dialog.ts (model cards and preview)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/Matrix4.html : makeRotationAxis takes a normalized axis and an angle in radians (line 49 normalizes it)
