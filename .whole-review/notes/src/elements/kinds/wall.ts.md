# src/elements/kinds/wall.ts
Lines: 64
Summary: Walls in the registry as walled elements: the wall system (geometry.ts) derives, moves, copies and deletes them; the kind supplies their solid from the base geometry, outlines (pieces), hit/distance, select-similar by type; plan drawing and panel are elsewhere (plan-view, ui/panel.ts).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: derived together by the wall system; "the GLB, the DXF … draw them" (exports taken out: F-0047)
- 7-12 imports: DocWall, WallSolid, isObject, Point2, ElementKind, insideRing
- 14 WALL_PREFIX 'wall'
- 16-29 toOutline: distance to a closed outline's sides (another copy of the segment-distance helper)
- 31-32 distance: 0 inside a piece, else the nearest piece outline (Math.min(Infinity, ...): Infinity with no pieces)
- 34-44 the kind: key, prefix, category walls, walled, icon, one = 'schedule.col.wall' (a label key of the schedules taken out, borrowed for the wall's title), many, dropped, exportName/exportColour (F-0047)
- 45-53 valid (id and level only; the file reader checks the rest), derive from the base geometry, element, outlines, hit within near, distance, pick 'walls'
- 54-57 moved/mapped do nothing of their own (the wall system does); similar by type
- 58-62 plan does nothing (plan-view draws walls); span; fields EMPTY: the walls' panel is ui/panel.ts's own from elements/wall/fields.ts wallFields, and nextWallFields is a second list for the next wall (root cause 1, F-0030)
- 63 the closing brace of the wall kind object

## Contracts, state and data flow
- Walls and openings are the two kinds whose fields bypass the registry: the goal's "one list per element" must bring them in.

## Depends on / used by
- uses: app/document.ts, app/geometry.ts (types), core/guards.ts, elements/room/derive.ts
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0030 (fields: () => [] at 62)
- F-0047 (export members, header)
- F-0036 (label key 'schedule.col.wall' from the removed schedules)

## To check in other files
- ui/panel.ts: the walls' panel

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : spreading an empty array adds no arguments (Math.min(Infinity, ...[]) is Infinity) (line 32)
