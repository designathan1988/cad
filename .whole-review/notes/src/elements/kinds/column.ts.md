# src/elements/kinds/column.ts
Lines: 85
Summary: Columns in the registry: validation, derivation (floor to the level's top or another level's floor, plus offset, at least 1 cm tall), selection, moving and mapping (turned by the transform), plan drawing (cut, structure fill), 3D extrusion of the outline, fields; plus dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: columns in the registry
- 3-11 imports: three, guards, insideRing, column commands/fields/schema, ElementKind, paint helpers, levelOf/NO_LEVEL (app/document: the one "level not found" stand-in, F-0139)
- 13-18 ColumnSolid: column, outline, bottom, top
- 20-29 the kind: key, prefix, category walls, icon, titles, dropped, exportName/exportColour (no reader: F-0047)
- 30-43 valid: id, level, point, sizes > 0, finite angle and offset, known shape, plate > 0, top level a string
- 44-52 derive (no memo: another level's height matters): its level, or NO_LEVEL when gone; bottom = level floor; top = the top level's floor or the own level's top, + offset; never under bottom + 1 cm (a top level below the column's own floor, F-0046, gives a 1 cm column that seems gone)
- 53-57 element, outlines, hit (inside or near an edge), pick before walls, span
- 58-64 moved; mapped: the centre and its x axis taken by the transform (the angle from the mapped x axis; width and depth scaled, at least 5 cm). A mirror reverses handedness but the outline is rebuilt with y = left of x, so an L column comes back rotated, not mirrored
- 65-66 onGrid (centre on the line); similar (same shape and section)
- 67-75 plan: filled as a structure layer, outlined with the wall line pen
- 76-80 solid: ExtrudeGeometry of the outline (no bevel) by the height, rotated −90° about x so plan y → −z and the extrusion → height; at y = bottom
- 81-82 dxfLayers/dxf (F-0047)
- 83-84 fields: columnFields with the doc

## Contracts, state and data flow
- ExtrudeGeometry triangulates the (non-convex I/H/L) outline properly, unlike a fan.

## Depends on / used by
- uses: three (ExtrudeGeometry, Shape, Vector2), core/guards.ts, elements/column/*, elements/room/derive.ts, elements/kinds/paint.ts, app/document.ts (levelOf, NO_LEVEL)
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0046 (effect: derive's 1 cm floor at 51)
- F-0047 (export members)
- F-0139 fixed (line 47 reads NO_LEVEL)

## To check in other files
- tools/transform.ts: whether a mirror's Transform tells kinds it mirrors (factor sign)

## Sources
- https://threejs.org/docs/pages/ExtrudeGeometry.html : depth (default 1) and bevelEnabled (default true); the shape in XY extruded along +Z (lines 77-78)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant instead of a repeated literal (NO_LEVEL, F-0139)
