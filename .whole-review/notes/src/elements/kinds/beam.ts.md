# src/elements/kinds/beam.ts
Lines: 119
Summary: Beams in the registry: the solid derived (hanging from the level's top with start/end offsets), the 3D sweep of its section along its axis, validation, selection, moving/mapping, plan drawing (dashed, above the cut), fields; plus the dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: beams in the registry
- 3-11 imports: three, guards, updateBeams, beamFields, beam schema, ElementKind, insideRing, paint helpers, levelOf/NO_LEVEL (app/document, F-0139)
- 13-21 BeamSolid: beam, outline, bottom/top, start and end tops
- 23-26 doc of sweep: section swept along a straight axis, in three.js axes (x, height, −y)
- 27-41 sweep: per section edge, a quad from start (z0) to end (z1) as two triangles
- 42-47 end caps from ShapeUtils.triangulateShape (earcut; it neither checks nor fixes winding): the start cap reversed (i,k,j), the end cap as given; the caps face outward only if earcut keeps the section's CCW order (to check how 'side' material is sided)
- 48-52 the geometry with vertex normals
- 54-63 the kind: key, prefix, category walls, icon, titles, dropped key, exportName/exportColour (no reader: F-0047)
- 64-78 valid: id, level, distinct finite points, width/depth > 0, finite offsets, rect or I, plate > 0
- 79-87 derive (memo by level): the level, or NO_LEVEL when gone (0 m, LEVEL_HEIGHT); tops at start and end; bottom = lower top − depth
- 88-97 element, outline, hit (inside or near the axis), pick after walls, span, moved, mapped (width scaled, at least 5 cm; depth not), onGrid (both ends on the axis line), similar (same section)
- 98-112 plan: dashed outline, filled when selected, fine pen
- 113-114 solid: the swept section, material 'side', edges drawn
- 115-116 dxfLayers/dxf: DXF export left (F-0047)
- 117-118 fields: beamFields over the beams, dispatching updateBeams

## Contracts, state and data flow
- mapped scales the width only (a Scale tool keeps the depth).

## Depends on / used by
- uses: three (BufferGeometry, ShapeUtils, Float32BufferAttribute), core/guards.ts, elements/beam/*, elements/room/derive.ts, elements/kinds/paint.ts, app/document.ts (levelOf, NO_LEVEL)
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0047 (exportName/exportColour/dxf here)
- F-0139 fixed (line 82 reads NO_LEVEL)

## To check in other files
- render/scene-3d.ts: the 'side' material's side (FrontSide would hide caps wound the wrong way)

## Sources
- https://threejs.org/docs/pages/ShapeUtils.html : triangulateShape returns index triples (contour then holes) and does not normalise winding; callers use isClockWise (lines 42-47)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant instead of a repeated literal (NO_LEVEL, F-0139)
