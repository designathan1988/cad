# src/elements/kinds/stair.ts
Lines: 147
Summary: Stairs and ramps in the registry: validation (kinds straight/L/U/spiral/ramp and their options), derivation from the level's floor and height, selection by its parts, moving/mapping (a mirror flips its turn), keep-out for room tags, plan (steps and landings outlined, walking line with arrow and start dot), 3D, fields with actions adding guardrails round its well and along its sides; dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: stairs and ramps in the registry
- 3-17 imports: guards, stairGeometry, ElementKind, insideRing, stair commands/fields/geometry/schema, trace, newId, railing commands/schema, stair well helpers, levelOf/NO_LEVEL (app/document, F-0139)
- 19-28 the kind: key, prefix, category floors, icon, titles, dropped, exportName/exportColour (F-0047)
- 29-46 valid: kind, grade > 0, point, angle, width and tread > 0, turn, height > 0, railing/well/winders booleans, split ≥ 1
- 47-52 derive (memo by level): stairSolid with the level's (or NO_LEVEL's) height and floor
- 53-58 element, outlines (its parts), hit (inside a part), picked before walls, span, moved
- 59-64 mapped: point and direction by the transform; width at least 40 cm × factor; a mirror flips left/right turn
- 65-74 keepOut: the screen box of its parts (Math.min/max over its points)
- 75-110 plan: each part outlined (filled when selected); the walking line, an arrowhead at its end and a dot at its start (fill colour copied from the stroke style)
- 111 solid: stairGeometry (risers closed except for spirals) at its bottom
- 112-116 dxfLayers/dxf (F-0047)
- 117-128 fields: updateStairs; a well guardrail when it reaches a level with an arrival and has none round its well yet (host stair, no side)
- 129-146 side guardrails for each side without one, as one step (host stair and side)

## Contracts, state and data flow
- Guardrails made here hold the stair (host): a user-made link; F-0053 is about moving them alone.

## Depends on / used by
- uses: core/guards.ts, render/prisms.ts, elements/stair/*, elements/railing/*, elements/room/derive.ts, core/id.ts, app/document.ts (levelOf, NO_LEVEL)
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0047 (export members)
- F-0139 fixed (line 50 reads NO_LEVEL)

## To check in other files
- elements/stair/geometry.ts stairSolid, well.ts

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle : a CSS colour string, gradient or pattern; may be set from strokeStyle (line 103)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant instead of a repeated literal (NO_LEVEL, F-0139)
