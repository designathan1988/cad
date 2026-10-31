# src/elements/kinds/floor.ts
Lines: 222
Summary: Floors and ceilings in the registry: validation, derivation (from a room or an outline; stair wells cut out; layer materials), following a room (copied with it, released to its outline when the room goes), selection, moving/mapping/transforming, plan drawing (fill, tiling clipped inside, dashed or dotted outline, holes crossed), 3D slab or one slab per build-up layer, caps, fields (with an edge guardrail action); plus dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: a room's floor follows its room; left with its outline when the room is deleted
- 5-22 imports: guards, Point2, slabGeometry, i18n, ElementKind, room commands/derive/fields/schema, stair wells, signedArea, trace, tilingDrawing, newId, railing commands/schema, materialIn, layerThicknessOk (layers/stack.ts)
- 24 FLOOR_PREFIX 'floor'
- 26-43 the kind: key, prefix, category floors, layer under, surface, icon, titles (ceilings named as such), dropped, exportName/exportColour (F-0047)
- 44-59 valid: thickness > 0, finite offset, a room or ≥ 3 points source, holes of ≥ 3 points, slope, each build-up layer with a material and a thickness layerThicknessOk accepts (the one rule, F-0136), tiling sizes > 0, kind
- 60-68 derive: deriveFloor; stair wells reaching its top cut out (area recomputed); layer materials
- 69-76 element, follows (its room), released (the room's outline), outlines, hit (inside), pick last
- 77-86 moved and mapped: only an outline floor moves its points (holes too)
- 87-96 transformed: a selected outline floor; a room's floor with its room (holes along), its copy following the room's copy
- 97 similar: same thickness
- 98-116 plan: outline with holes (even-odd), filled unless a ceiling not selected
- 117-150 the tiling drawn inside (clip even-odd under save/restore), then the outline traced again (the tiling's beginPath replaced the path, not the clip)
- 151-174 dashed (floor) or dotted (ceiling) outline; each floor hole crossed between its outermost corners
- 175-193 solid: a sloped one by riseAt; with layers, one slab per layer from the top down (their thicknesses summed may differ from top − bottom used by span and caps: to check in setFloorLayers); else one slab of top − bottom, rotated into three.js axes
- 194-195 span (bottom to top) and caps (its outline as an upright prism)
- 196-221 fields: floorFields with room names, update as one step over several floors, holes, an edge guardrail (none for ceilings or when one exists) on its outline closed, materials, layers, tiling

## Contracts, state and data flow
- A room's floor is tied to its room: a user-made link (made from the room) shown in the panel (the room's name).
- The build-up's thickness rule is layers/stack.ts's, the same setFloorLayers applies (F-0136). An empty layers list is still accepted on reading (every() of nothing), so an old file's floor is not dropped for it.

## Depends on / used by
- uses: render/prisms.ts (slabGeometry), render/tiling.ts, elements/room/*, elements/stair/well.ts, elements/railing/*, elements/material/schema.ts, elements/layers/stack.ts, core/guards.ts, core/id.ts
- used by: elements/registry.ts; next-element.ts (floors, ceilings)

## Problems found (finding IDs)
- F-0047 (export members)
- F-0136 fixed (line 57 uses the shared rule)

## To check in other files
- elements/room/commands.ts setFloorLayers: thickness kept equal to the layers' sum

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/clip : clip keeps the path (only beginPath clears it); the clip region is saved/restored state (lines 117-150)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : non-numbers and Infinity/NaN are not finite (layerThicknessOk, line 57)
