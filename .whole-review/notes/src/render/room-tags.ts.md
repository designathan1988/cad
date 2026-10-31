# src/render/room-tags.ts
Lines: 156
Summary: Places room tags in plan: name and area when the room is wide enough on screen, else its number with the area or a brief warning. A tag is moved off the temporary dimensions' values (below or above, inside its room) and stepped aside from dimension lines, nearest way first. It is skipped off-canvas or over another tag. Pure; the caller measures text.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: what tags say and where; none off the canvas or over a placed tag; pure
- 5-28 RoomTagInput (screen point, width, name, number, area, brief warning, outline) and RoomTag (point, lines, box, input index)
- 30-35 PAD 8, LINE 16, Box, Segment, meets (box overlap)
- 37-59 crosses: Liang–Barsky test of a segment through a box (parallel edges by q < 0)
- 61-62 STEP: 6 px per step aside from a dimension line
- 64-73 insidePolygon: the even-odd ray test (a copy of the one in app/geometry and room/derive)
- 75-84 within: a box's four corners inside the outline
- 86-98 layoutRoomTags signature: avoid boxes (dimension values), dimension lines
- 99-107 per tag: on the canvas; the longest text that fits the room's width (name/area, number/area, number/brief, number)
- 108-118 a value box in the way: below or above, inside the room and the view, else no tag
- 119-148 a dimension line through it: stepped across by up to half its width plus, up or down by up to its height, the first free spot
- 149-155 dropped when it still meets a placed tag or a value; placed with its text position following the box (index by indexOf, quadratic)

## Contracts, state and data flow
- Pure; first tags placed win, later overlapping ones are left out.

## Depends on / used by
- uses: nothing
- used by: render/plan-view.ts (drawRoomTags)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Liang%E2%80%93Barsky_algorithm : the p/q inequalities, the parallel case and entry/exit bounds (lines 37-59)
