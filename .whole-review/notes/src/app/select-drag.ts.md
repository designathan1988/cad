# src/app/select-drag.ts
Lines: 443
Summary: The select tool's gestures: press, drag and release over walls, rooms, registry elements, a single door or window (slid along or onto another wall), a dimension line, wall grips/arrows/rotate/arc handles, and the window/crossing marquee; each drag one command on release, Esc cancels; plus marquee picking and a convex hull.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-8 header: click selects (Shift toggles); drag a wall moves the selection with joins (Alt alone); rooms move their point; a door/window slides along or onto another wall, "placed by the same rule as when it was put there (measured from the nearest wall face or opening, in 5 cm steps)"; grips stretch; empty space: window (→) or crossing (←) selection; Esc cancels
- 10-30 imports: collision, arrange boxes, smart guides, vector, setWalls, wall types, edit tools (move/rotate/stretch), arc edit, handles, carry (moveRooms, roomsGoingWith), snap, App, DocWall, insidePolygon, opening commands (detachedFrom, ungroupOpenings, wallRule), opening types, dimension anchor/commands, registry, ruleAt, aimAlong/aimAt
- 32-76 Drag: move (origin, delta, walls moved, the walls as they would be, rooms and registry elements going), grip, stretch (grab kept), rotate (pivot, angles, rooms), bulge, slide (opening id, grab along the wall, openings as they would be, groups with its own undone, the opening as taken), dimLine (offset), marquee
- 78-84 Pending: what was pressed (wall/element, grip, stretch arrow, rotate handle, bulge, empty) and where
- 86-91 ROTATE_STEP 15°, THRESHOLD_PX 4 (a drag starts past it), SMART_PX 8
- 93-111 smartBoxes: the selection's box and every other shown element's box (walls' pieces, kinds' outlines but endless ones) for smart guides
- 112-115 STRAIGHT_PX 8 (an arc straightened near its chord); gripPx: 22 px when the primary pointer is coarse, else 8 (same pattern as F-0031)
- 117-124 SelectGestures: down, move (snap function, Shift, Alt), up (true for a click), cancel
- 126-134 selectGestures state: pending press, collision shapes and smart boxes per drag
- 135-160 down: a door's flip control acts at once; else a grip, stretch arrow, rotate or bulge handle is pending; an element: Shift toggles it in the selection (the Set mutated in place), else it alone unless already selected; empty space clears (unless Shift); refresh
- 162-176 move, starting a drag past 4 px: the selected walls moved (an axis moves alone: nothing on its line is tied to it, F-0051), rooms going with them (carry.ts) and the selected rooms, registry elements of the selection (not rooms), a single selected opening or dimension
- 177-178 a selected dimension pressed: its line dragged
- 179-188 a single opening: the grab along its wall; its distributed group undone (members kept where they are); the openings measured from it (fromOpening/aligned) detached and held by their walls (detachedFrom → wallRule): the neighbours do not move with it
- 189-192 a move with walls/rooms/kinds; the smart boxes in plan
- 193-204 grip, stretch (grab from the end), rotate (start angle), bulge, marquee
- 205-217 during the drag: marquee corner; a dimension line's offset through the pointer (5 cm steps with snaps)
- 218-238 move: delta (Shift locks an axis; 5 cm grid with snaps; smart guides in plan; with collisions, elements alone clamp against obstacles); the walls moved with joins (moveWalls) or alone (Alt)
- 239-252 grip: the end to the snap; stretch: along its own line, length on the 5 cm grid
- 253-259 bulge: from the middle point; straightened within 8 px with snaps
- 260-280 slide: the centre at the pointer less the grab; the aim on a wall under it (or along its own); the rule from the aim (ruleAt: measured from the nearest wall face/stop or opening, 5 cm steps); a door moved to another wall takes the pointer's side; then wallRule: a fromOpening/aligned rule turned into fromStart/fromEnd by its distance from the wall's nearer END. A fromStart/fromEnd from ruleAt is a station from its end; keep-openings.ts moves it only with its own wall (F-0008 fixed)
- 281-286 rotate: angle from the start, 15° steps with snaps or Shift; the selected walls turned
- 287-288 every drag step refreshes the view
- 290-298 up: the state cleared; a click is a press on an element without a drag
- 299-310 move/rotate: rooms and registry elements moved with the walls in one command (cmd.move or the walls' label); nothing when nothing changed
- 311 grip/stretch/bulge: the walls set
- 312-318 slide: the openings that differ from the store (JSON compare) and the groups, one command; nothing when let go unchanged
- 319-323 dimLine offset; marquee selection; refresh; returns whether it was a click
- 325-336 cancel: drops the press and drag (Esc); false when nothing was going on
- 338-342 Pickable: id and screen outlines
- 344-353 dragTransform: translation or rotation about the pivot
- 355-371 marqueePick: window (left to right) wholly inside; crossing (right to left) any outline touching the rectangle
- 373-398 selectByMarquee: screen outlines per element at its level's lift (hull in 3D); kinds with a height as prisms in 3D; endless ones (guides, axes) as a very long line so only crossing takes them

- 399-402 the picked ids added (the selection cleared first unless Shift)
- 404-422 polygonTouchesRect: a vertex inside the rectangle, a corner inside the polygon, or two edges crossing (collinear: overlapping extents)
- 425-441 hull: Andrew's monotone chain (sorted, cross ≤ 0 pops collinear points, lower + upper without their last points)

## Contracts, state and data flow
- Root cause 2: a dragged opening no longer drags neighbours measured from it (detachedFrom) and is itself turned from fromOpening to a wall rule (wallRule); keep-openings.ts no longer ties it to a neighbouring wall's face (F-0008). An axis dragged takes nothing along (F-0051). The header still says "measured from the nearest wall face or opening" (what is shown and typed: the gap to that face).
- cancel() exists for Esc; whether a pointercancel reaches it is input.ts's (F-0024).
- ui.selection is mutated in place (147-151, 154, 400-401): consumers keyed on its identity would miss these changes (to check: panel key).

## Depends on / used by
- uses: app/collision.ts, tools/arrange.ts, tools/smart-guides.ts, tools/edit.ts, tools/arc-edit.ts, tools/snap.ts, tools/opening-tool.ts (ruleAt), app/handles.ts, app/carry.ts, app/opening-ui.ts, elements/opening/commands.ts, elements/wall/commands.ts, elements/dimension, elements/registry.ts, app/geometry.ts
- used by: app/input.ts (selectGestures), app/frame.ts (Drag preview), app/app.ts (Drag type, dragTransform), tests

## Problems found (finding IDs)
- F-0008 fixed (in keep-openings.ts)
- F-0051 fixed (162-176: no carrying along an axis)
- F-0031 (same coarse-pointer pattern at 115)

## To check in other files
- app/frame.ts / panel: how the selection's identity is used

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round : ties round toward +∞ (−2.5 → −2): grid snapping of negative deltas is not symmetric at exact halves (lines 215, 221, 250, 283)
- https://en.wikibooks.org/wiki/Algorithm_Implementation/Geometry/Convex_hull/Monotone_chain : sort, pop on cross ≤ 0, drop each chain's last point (lines 425-441)
- https://help.autodesk.com/cloudhelp/2015/ENU/Revit-Model/files/GUID-E8F03F7F-8886-4F92-B821-D2C500CEB64F.htm : "Moves With Grids", an instance property the user sees and sets (F-0051)
