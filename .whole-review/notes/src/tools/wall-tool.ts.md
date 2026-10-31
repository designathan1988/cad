# src/tools/wall-tool.ts
Lines: 228
Summary: The wall tool as a pure state machine with a written table: chains of straight walls (click, typed length and angle, closing on the chain start, Enter/Escape), arc mode (A: a chord then a bend point or a typed radius), rectangle mode (Q: two corners or typed sides toward the cursor's quadrant, four walls counter-clockwise). Also the geometry helpers typedEnd, bulgeThrough (three-point arc) and bulgeForRadius.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-25 header: the transition table for drawing, arc and rectangle modes
- 27-28 imports: tolerances and vector helpers
- 30-52 WallToolState: idle (arc/rect flags), rect (corner, cursor), drawing (start, last, cursor, count, arc), bend (start, last, end, cursor, count)
- 54-64 WallToolEvent: move, click, typed (length, angle), typedRadius, arc, rect, typedSides, enter, escape
- 66-76 WallToolResult (state, one segment with optional bulge, several segments, rejected) and IDLE
- 78-87 wallTransition: rect toggles (ends a chain); rect state delegated; arc toggles (bend back to drawing, idle flag, drawing flag)
- 88-94 idle: click starts a rectangle or a chain; typed values rejected
- 95 bend state delegated to bendTransition
- 96-109 drawing: move updates; a click under MIN_WALL_LENGTH rejected; arc mode fixes the chord (snapped to start after 2 walls); else a wall, closing on the start after 2 walls
- 110-118 typed length ≥ MIN_WALL_LENGTH: the end along the angle or toward the cursor; arc mode goes to bend
- 119-126 typed radius/sides rejected; enter/escape end the chain (arc mode kept)
- 128-138 rectangle: the four counter-clockwise walls (exterior out), null when a side is too short
- 140-162 rectTransition: move, click → rectangle, typed sides toward the cursor's quadrant, escape/enter drop it, others rejected
- 164-190 bendTransition: done → segment with the bulge, closes at the start; click → bulgeThrough; typed radius → bulgeForRadius toward the cursor; escape drops the chord; enter ends
- 192-204 typedEnd: along the typed angle or toward the cursor (+x when on the last point)
- 206-218 bulgeThrough: inscribed angle at c gives θ/4 = (π − ∠c)/2; sign by c's side of a→b; null when c is on the chord's line
- 220-227 bulgeForRadius: the minor arc's sweep 2·asin(c/2r), on the side of `toward`; null when r < c/2

## Contracts, state and data flow
- Pure. The caller (wall-ui.ts) snaps points (the chain start is offered by the snap so closing within POINT_TOLERANCE works) and creates the walls.
- Bulge convention: positive = counter-clockwise = to the right of start→end (same as arc-edit.ts).

## Depends on / used by
- uses: core/tolerance, core/vector
- used by: app/wall-ui.ts (wallTransition, rectangle, typedEnd, bulgeThrough), app/app.ts (IDLE and types)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Inscribed_angle : an inscribed angle is half the central angle on the same arc; on the opposite arc it is supplementary, so ∠c = π − θ/2 (lines 206-218)
