# src/elements/kinds/railing.ts
Lines: 139
Summary: Guardrails in the registry: validation, derivation of the path (its own points; a floor's closed edge on the floor's top; a stair's side rising with it, or round its well on the floor it reaches), held by its stair or floor (deleted with it), selection, moving/mapping (lets go of the host), plan (path and post ticks), 3D (frame and glass), fields; dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: held by a stair it takes its path from it every time
- 5-18 imports: guards, Point2, railingGeometry, ElementKind/KindSolid, railing commands/fields/schema, materialIn, stair geometry/schema/well, deriveFloor, paint helpers
- 20-29 RailingSolid: railing, foot height, path, rise per point, glass material
- 31-40 the kind: key, prefix, category floors, icon, titles, dropped, exportName/exportColour (F-0047)
- 41-54 valid: ≥ 2 points, height > 0, finite base offset, host (stair with optional side index, or floor), infill kind
- 55-67 derive (not memoised): the foot from the level; a floor host → the floor's closed outline on its top (+ offset)
- 68-76 a stair host → its solid; a side index the stair no longer has → its stored points
- 77-86 along a side: the feet a handrail's height under the side's line, from the lowest; rise per point
- 87-90 round the well at the arrival, else its stored points
- 91-97 element, holders (stair or floor), outlines, hit near the path, picked before walls, span (top with the highest rise)
- 98-106 moved and mapped: the host dropped and the STORED points moved — for a hosted railing those are the points it was created with, not the path it shows (the stair's or floor's), so moving it alone makes it jump to an old path (F-0053)
- 107-121 plan: the path and a 5 px square at each post (fillRect paints at once, outside the path)
- 122-127 solid: frame (side material) and, with glass infill, the panes in the project's glass
- 128-129 dxfLayers/dxf (F-0047)
- 130-138 fields: railingFields over the railing with its derived points

## Contracts, state and data flow
- Host links (stair, floor) are made by the user (the edge guardrail action, the stair's) and shown by the railing following its host.

## Depends on / used by
- uses: core/guards.ts, render/prisms.ts (railingGeometry), elements/railing/*, elements/stair/*, elements/room/derive.ts, elements/material/schema.ts, elements/kinds/paint.ts
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0053 a hosted guardrail moved alone jumps to its stored points
- F-0047 (export members)

## To check in other files
- elements/railing/schema.ts postsOf, wellPath; elements/stair/well.ts

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillRect : draws at once without changing the current path (line 118)
