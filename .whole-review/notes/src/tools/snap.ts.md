# src/tools/snap.ts
Lines: 501
Summary: The drawing snaps: from the cursor (radius 10 px in metres), the point the user most likely means, in a fixed priority: chain start, wall ends (reached from the body's corners), element points and arc centres, guide crossings (line/line, line/wall, circle/line, circle/wall), wall line intersections, the origin, midpoints, divisions, then angle or wall-parallel directions from the last point (length on the 5 cm grid), perpendicular foot, on a wall's body (arc or straight), on a guide, on a circle guide, extensions past ends, alignment with wall ends/acquired points/origin, else the angle snap or the grid. Shift (orthogonal) and a held direction (locked) have their own paths. Tab skips points already offered.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: snaps in screen pixels converted by the caller
- 4-7 imports: vector helpers, arc helpers, arcMiddle, MessageKey
- 9-40 SnapKind (22 kinds) and Snap (point, kind, guideFrom, wallId)
- 42-92 SnapInput: cursor, mpp, segments (id, ends, reach, face, bulge), from, chainStart, enabled, orthogonal, guides, element points, parts, skip (Tab), lock, acquired points, circles
- 94-98 GuideLine: a point and a unit direction
- 100-112 constants: GRID_STEP 5 cm, RADIUS_PX 10, ORIGIN, ANGLE_STEP 15°, ANGLE_TOL_DEG 5° (why), EXTENSION_REACH 8 m, MIN_SNAP_RUN 1 cm
- 114-137 snapLabel: the i18n key per kind (none for angle, grid, none)
- 139-148 snap: radius; locked and orthogonal first; disabled → cursor; `fresh` passes over skipped points
- 150-163 chain start; nearest wall end (corner for face segments), reach·√2 added per end
- 164-179 element points and arc centres
- 180-203 guide crossings with guides, walls (arcs within their sweep, segments ends included) and circles
- 204-213 crossings of straight wall lines passing near the cursor (pairs)
- 214-215 the origin (0, 0) within the radius
- 216-226 midpoints of non-face segments (arc middles for arcs)
- 227-244 division points (thirds unless parts given; the middle left out)
- 245-272 direction from the last point: 15° steps or a wall's direction/square within 5°, nearest wins; the length rounded to 5 cm (at least one step)
- 274-290 perpendicular foot on the nearest wall line from the last point, within the body
- 292-324 on a wall's body: arc foot on the 5 cm grid or where the snapped ray cuts it (within slack); straight foot on the grid or the ray's crossing (within slack); onFace for faces
- 326-338 on a line guide: the ray's crossing within slack or the grid foot
- 340-347 on a circle guide: the radial foot
- 349-365 extension past a wall's end within 8 m and the radius; the ray's cut within slack or the grid point
- 367-388 alignment across or up with wall ends, chain start, acquired points, then the origin (axis); slides along the snapped ray without a slack check (F-0105); else the angle snap; else the grid
- 390-402 orthogonal: the dominant axis from `from`, length on the grid; stops on a guide crossed near the pointer
- 404-424 locked: the foot on the held line on the grid; the nearest crossing with a straight wall or guide within r, beyond 1 cm
- 426 perpOf: the left perpendicular of a unit vector
- 428-442 arcFoot: the point at p's angle strictly within the sweep, optionally the length along rounded to a step away from the ends
- 444-453 circleCrossings: line/circle by the quadratic (u unit), 0–2 points (tangent gives two equal)
- 455-461 lineCrossing: null when the cross is under 1e-9 relative
- 463-464 onGrid: both coordinates rounded to 5 cm
- 466-479 closest: the nearest accepted point within r, each compared less its reach
- 481-489 projectOnSegment: the foot strictly inside, optionally rounded to a step away from the ends
- 491-500 rayOnSegment: the ray's crossing strictly inside the segment and ahead

## Contracts, state and data flow
- Pure; the first rule that fires wins, so the order is the priority. Per call cost is O(segments + guides²) plus the pairs of lines near the cursor.
- Ray-following snaps are bounded by `slack` (r plus the 5° spread at the pointer's distance), except the alignment (F-0105).

## Depends on / used by
- uses: core/vector, elements/wall/geometry/arc (arcOf, pointAt), tools/arc-edit (arcMiddle), ui/i18n (MessageKey)
- used by: app/input.ts (snap), app/frame.ts (snapLabel), app/select-drag.ts (GRID_STEP, Snap), app/app.ts (Snap type); GRID_STEP also by tools/guide-tool.ts

## Problems found (finding IDs)
- F-0105 (S4): alignment along a steep snapped direction has no distance bound

## To check in other files
- none

## Sources
- https://help.sketchup.com/en/sketchup/introducing-drawing-basics-and-concepts : SketchUp's point inferences (endpoint, midpoint, on edge, intersection) and linear ones (on axis, from point, parallel, perpendicular), locked with Shift or the arrow keys (lines 139-424, the model this follows)
