# src/elements/opening/sides.ts
Lines: 24
Summary: openingSides: the enclosed room on each side of an opening, found 30 cm past each wall face at the opening's middle, so the panel names the swing side by room instead of left or right.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: rooms named instead of left/right of the drawing direction
- 4-6 imports: vector add/scale, insidePolygon and OpeningSolid, RoomSolid
- 8-9 PROBE: 0.3 m past the faces
- 11-23 openingSides: none without a frame; the enclosed rooms; the first whose outline holds the probe point (even-odd ray test); left along the frame's normal past the outer face, right past the other

## Contracts, state and data flow
- Pure. Left is the side along the frame's normal, as in parts.ts and symbol.ts (a door swinging left opens toward the normal).
- insidePolygon (app/geometry.ts:413-421) is the even-odd crossing test; rooms are outlines without holes (room/derive.ts:15).

## Depends on / used by
- uses: core/vector, app/geometry (insidePolygon, OpeningSolid), room/derive (RoomSolid)
- used by: opening/fields.ts (leafFields: swing labels and the hinge note)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Point_in_polygon : the even-odd ray test; boundary points depend on the details (line 19 through insidePolygon)
