# src/app/room-ui.ts
Lines: 157
Summary: The room tool (a click inside closed walls makes a room, numbered on the level), the floor tool (a click in a room floors it or makes its ceiling; otherwise an outline of corners), holes in a floor, a room's floor and ceiling, and finishing an outline. Functions over the App.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: rooms and floors from the plan, app.ts delegates
- 3-12 imports: vector, i18n, LEVEL_HEIGHT and levelOf, next-element, Floor/Room types, deriveGeometry, newId, room commands, insideRing/signedArea, App type
- 14-20 roomSpaceAt: none when an enclosed room is there; else the smallest space of the level around p (sort on a fresh filtered list)
- 22-31 roomClick: an enclosed room already there → selected with a hint
- 32-34 the new room: number = rooms on the level + 1 (repeats an existing number after a deletion: F-0035), default name, from the next room's template
- 35-39 probed alone in a derived doc: not enclosed → error
- 40-46 added, selected, hint
- 48-77 floorClick: no draft, not typed, no hole: a click in an enclosed room makes its ceiling (ceiling tool; an existing one selected) or its floor (an existing one selected)
- 78-85 within 10 px of the first corner (3+) finishes; else a corner added (the info cleared)
- 87-93 startFloorHole: floor tool drawing a hole through the floor
- 95-108 addCeilingToRoom: once per room; at the room's height (own, level's or LEVEL_HEIGHT: document.ts, imported at 5, F-0139) + the next ceiling's thickness; selected
- 110-119 addFloorToRoom: once per room; from the next floor's template; selected
- 121-125 floorFinish: the draft taken; fewer than 3 corners dropped
- 126-136 a hole: added to its floor, the floor selected (set twice around setTool), select tool
- 137-144 a ceiling outline from the next ceiling's template (its offset is the template's, not recomputed for this level)
- 145-149 a floor outline from the next floor's template
- 151-156 startCeiling: the floor tool in ceiling mode

## Contracts, state and data flow
- Elements made from next-element.ts templates (made), as the goal's pattern.

## Depends on / used by
- uses: app/next-element.ts, app/geometry.ts (visibleGeometry, deriveGeometry), elements/room (commands, derive, schema), app/document.ts, ui/i18n.ts, core/id.ts
- used by: app/app.ts (delegates), app/input.ts (clicks), context actions (add floor/ceiling)

## Problems found (finding IDs)
- F-0035 a new room's number can repeat one in use

## To check in other files
- next-element.ts blank ceilings: offset from the level shown; an outline ceiling on another level after a template from a taller level

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort : sorts in place, stable, negative = a first (line 19, on a fresh array from filter)
