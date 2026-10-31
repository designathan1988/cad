# src/elements/kinds/roof.ts
Lines: 108
Summary: Roofs in the registry: validation, derivation on the level's top in its covering's material (gables closed by walls under the roof left out), selection (inside, last of all), moving/mapping (a mirror reverses the outline and re-pairs the sides), plan (dashed eaves, faint ridges and hips), 3D, fields; dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: roofs in the registry
- 3-14 imports: materialLabel, guards, roofGeometry, ElementKind, roof commands/fields/geometry/schema, materials, insideRing, trace, levelOf/NO_LEVEL/wallBand/wallTop (app/document)
- 16-25 the kind: key, prefix, category walls, icon, titles, dropped, exportName/exportColour (F-0047)
- 26-41 valid: ≥ 3 points, one edge each (grade or null, overhang ≥ 0), a known kind, thickness > 0, base offset, parapet ≥ 0, covering material and thickness
- 42-46 derive (not memoised): the faces on the level's top (its level, or NO_LEVEL when gone: F-0139); the covering's material
- 47-57 gables whose two ends and middle lie in the band of a wall under the roof (top kind roof) are dropped (the wall closes them)
- 58-63 element, outline, hit inside, picked last (its overhang), span
- 64-72 moved; mapped: outline mapped, overhangs scaled; a mirror reverses the outline (copied first, reverse mutates) and maps new side i to old side (2n − 2 − i) mod n, which is the side between the same corners
- 73-99 plan: the outline dashed, filled faintly when selected; the faces' polygons dashed and faint
- 100 solid: roofGeometry of faces, gables, parapets with its thickness, in the covering material
- 101-105 dxfLayers/dxf (F-0047)
- 106-107 fields: roofFields with the materials

## Contracts, state and data flow
- Not memoised: every derivation scans all walls of its level (wallTop, wallBand).

## Depends on / used by
- uses: render/prisms.ts (roofGeometry), elements/roof/*, elements/material/schema.ts, app/document.ts (wallBand, wallTop), core/guards.ts
- used by: elements/registry.ts; app/document.ts (roof covers for walls: F-0013)

## Problems found (finding IDs)
- F-0047 (export members)

## To check in other files
- elements/roof/geometry.ts roofSolid

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse : reverses in place; copy first ([...a].reverse()) to keep the original (line 71)
