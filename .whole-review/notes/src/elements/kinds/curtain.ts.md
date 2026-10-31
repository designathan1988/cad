# src/elements/kinds/curtain.ts
Lines: 119
Summary: Curtain walls in the registry: validation, derivation (frame and panels with their materials), selection, moving/mapping, plan drawing (two thin faces, the glass line, full-height mullions filled), 3D as two geometries of boxes (frame metal, panels glass or plaster), fields; plus dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: curtain walls in the registry
- 3-13 imports: three, guards, ElementKind/KindSolid, curtain commands/fields/geometry/schema, materials, insideRing, paint helpers, levelOf/NO_LEVEL (app/document, F-0139)
- 15-19 CurtainBuilt: the solid plus frame and panel materials
- 21-43 boxes: each plan box as 12 triangles (top up, bottom down, sides outward for a counter-clockwise polygon; checked by the cross products: plan y → −z keeps them outward), flat normals
- 45-54 the kind: key, prefix, category walls, icon window, titles, dropped, exportName/exportColour (F-0047)
- 55-70 valid: distinct finite ends, finite base offset, height > 0, valid grid rules (no bound: F-0049 from files), mullion and depth > 0, panel kind
- 71-79 derive (memo by level): its level or NO_LEVEL; curtainSolid at the level's height and floor; materials metal, glass or plaster from the library
- 80-88 element, outlines, hit, pick before walls, span, moved, mapped (ends only), onGrid, similar (same grid, frame and panel)
- 89-107 plan: outline filled with canvas (or selection), its faces and the middle line, full-height frame boxes filled
- 108-111 solid: frame and panels
- 112-116 dxfLayers/dxf (F-0047)
- 117-118 fields: curtainFields over the solids

## Contracts, state and data flow
- Every frame box and panel is a separate set of 12 triangles: an unbounded grid (F-0049) makes geometry proportional to cells.

## Depends on / used by
- uses: three, core/guards.ts, elements/curtain/*, elements/material/schema.ts (materialIn), elements/room/derive.ts, elements/kinds/paint.ts, app/document.ts (levelOf, NO_LEVEL)
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0049 (valid accepts any positive grid value)
- F-0047 (export members)
- F-0139 fixed (line 73 reads NO_LEVEL)

## To check in other files
- elements/material/schema.ts materialIn: the fallback when the library lacks metal/glass

## Sources
- https://threejs.org/docs/pages/BufferGeometry.html : computeVertexNormals gives non-indexed triangles their face normal; winding decides its side (lines 39-42)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant instead of a repeated literal (NO_LEVEL, F-0139)
