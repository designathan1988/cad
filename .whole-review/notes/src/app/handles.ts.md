# src/app/handles.ts
Lines: 139
Summary: Pure positions and hit test of the selection's handles on screen: end squares and stretch arrows of one wall, the bend diamond of one arc wall, the turn handle under the selection (clear of the other handles and of the temporary dimension values), and a door's two flip controls; used in plan and (since 2c739a7) in 3D.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: "The handles of the selection in plan…" (now also drawn and hit in 3D: app.ts handles(); F-0018)
- 6-10 imports: vector helpers, WallEnd/WallId, DocWall, arcMiddle (arc-edit), arcOf (wall arc)
- 12-16 ARROW_OFFSET 20 px, ROTATE_OFFSET 28 px, HANDLE_CLEAR 26 px
- 18-30 Handles: squares (wall, end, at), arrows (+ direction), rotate (screen at, world pivot), bulge, flips (swing/hinge with their axis)
- 32-38 HandleHit kinds; Box
- 40-45 discMeets: a disc touches a box (closest point within r)
- 47-86 handlesFor(walls, toScreen, avoid): nothing for no walls; one wall → its two end squares, and for a straight one two arrows 20 px beyond its ends along the screen direction; the extent of all (ends, and an arc's axis-extreme points), its middle as the pivot; the turn handle 28 px under the lowest screen point, moved under the lowest other handle if it comes within 26 px of one, then under each temporary dimension value it would cover; one arc wall → its middle as the bulge handle
- 88-98 extentOf: a wall's ends, plus for an arc the points at 0°, 90°, 180°, 270° within its sweep (negative remainders brought into 0..2π)
- 100-110 handleAt: within reach, by priority flip, rotate, bulge, arrow, square
- 112-138 doorFlips: none under 36 px wide on screen; on the leaf's side, 16 px out from that face's screen position at the middle of the door, swing 12 px before the middle (axis across), hinge 12 px after (axis along)

## Contracts, state and data flow
- toScreen must give finite screen points; in 3D app.ts maps points behind the camera to (-1e6, -1e6), which then take part in min/max and directions (an arrow's direction from such a point is meaningless, but it is drawn off screen).

## Depends on / used by
- uses: core/vector.ts, tools/arc-edit.ts, elements/wall/geometry/arc.ts
- used by: app/app.ts (handles), app/select-drag.ts (handleAt), app/chrome.ts (float bar avoids them), app/view-ui.ts (turn handle position), render/plan-view.ts and overlay-3d.ts (drawHandles), tests/app/handles.test.ts

## Problems found (finding IDs)
- F-0018 the header says "in plan"

## To check in other files
- render/plan-view.ts drawHandles sizes vs these offsets

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder : % keeps the dividend's sign (line 93-94 adds 2π to a negative result)
