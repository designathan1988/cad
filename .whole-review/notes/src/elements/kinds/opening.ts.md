# src/elements/kinds/opening.ts
Lines: 87
Summary: Doors and windows in the registry, as walled elements: placed, moved, copied and deleted by the wall system; the kind supplies their derived item (with the wall's level), selection outlines and extent with the symbol, hit and distance, select-similar; their plan drawing and panel are elsewhere (plan-view drawOpenings, ui/panel.ts openingPanel).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: placed with their walls; "the GLB, the DXF … draw them with their walls" (exports taken out: F-0047)
- 7-14 imports: openingOutline/OpeningSolid, isObject, Point2, ElementKind, Opening/prefix, symbolLines, insideRing, nearSegment
- 16-17 OpeningItem: the placed opening and its wall's level
- 19-33 toLines: distance from a point to closed or open polylines (Infinity start)
- 35-45 the kind: key, prefix, category openings, walled, icon door, one and many both "panel.door" (a window is titled "door" wherever the registry's title is used without a special case), dropped, exportName/exportColour (F-0047)
- 46-47 valid: only id and wall id here (the file reader checks the rest)
- 48-56 derive (placed and its wall's level, null when not placed), element, levelOf, levelIn, holders (its wall)
- 57-73 outlines, extent with the symbol, hit (inside, near the outline or the symbol: a click on a door's leaf), distance
- 74-80 picked before walls; moved/mapped do nothing of their own (the wall system moves them); similar: kind, sizes and style
- 81-86 plan does nothing (drawn with the walls); span; fields EMPTY: the openings' panel is ui/panel.ts openingPanel built from elements/opening/fields.ts openingFields — a separate path from every other kind's fields, and nextOpeningFields is a second list for the next opening (root cause 1, F-0030)

## Contracts, state and data flow
- Openings are the one kind whose panel and placing tool do not go through the registry's fields: why the "one list per element" fix (goal RC1) has to bring openingFields into this kind.

## Depends on / used by
- uses: app/geometry.ts (openingOutline, OpeningSolid), core/guards.ts, elements/opening/*, elements/room/derive.ts, elements/kinds/paint.ts
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0030 (fields: () => [] at 85; the panel elsewhere)
- F-0047 (export members, header)

## To check in other files
- ui/panel.ts: openingPanel and where kind.one is shown for openings (panel.ts:153)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Infinity : Infinity is greater than every number, a starting value for a minimum (lines 21, 30)
