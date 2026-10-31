# tests/tools/snap.test.ts
Lines: 250
Summary: Hand-worked tests of the snapping engine, at 1 mm per pixel so the 10 px radius is 1 cm. Snap kinds covered:
- on a wall's body, its end (including from a thick wall's corner within its reach) and its middle; ends and middle win over the body;
- alignment with an end, sliding along a 15° drawing direction;
- which wall each snap names;
- the origin and the drawn axes (a wall-end alignment wins over an axis);
- a partition ending square on a wall along its snapped angle;
- the distance along a wall on the 5 cm grid;
- a thick wall's body beyond the radius;
- a face edge for the measure tool (corners, points on the face, no middle);
- guides: on a guide, where a guide crosses a wall's line or another guide, a snapped angle meeting a guide, and Shift stopping on a crossed guide;
- arc walls: the middle on the arc, the foot on the arc, nothing off its sweep, a drawing direction cutting it, its centre and its thirds;
- division points (thirds by default, n parts on request, the middle staying the midpoint), element points before the body, and Tab passing over candidates (nextSnap in input.ts:958-964);
- smart snaps: intersection, perpendicular, extension and parallel.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-16 header (1 mm/px); imports; input() with one 6 m wall along x
- 18-37 onWall at the cursor's foot; a 25 cm wall's end taken from its outer corner (reach 0.125), not without the reach; endpoint and midpoint win
- 39-55 alignment with the end (6, 2); from (0, 3) at −45° the alignment slides along that direction to (6, −3)
- 57-68 wall ids for end, middle, body and alignment over two walls
- 70-86 origin within the radius on an empty plan, the grid beyond; the axis x = 0 with a guide from the origin; a wall end's alignment wins
- 88-100 a partition from (2.03, −3) ends at (2.03, 0) (square); starting on a wall, the distance on the 5 cm grid (4.05)
- 102-110 a 15 cm wall's body 6 cm off the axis is still onWall; past body and radius it is not
- 112-119 a face edge: corner at its ends, onFace on it, no midpoint; suite closes
- 121-150 guides: onGuide on the grid; guideCross with the wall's line and with another guide; a snapped angle meets the guide square; Shift up stops on the guide near the cursor, else 'angle'
- 152-188 a half-circle arc: midpoint (2, −2), not the chord's; the foot 2 m from the centre (at 315°, away from the thirds); nothing off the sweep; down from (3.5, 1) cuts it at (3.5, −√1.75); centre and thirds
- 190-221 divisions in thirds and quarters; the middle stays midpoint; an element node before the body; Tab: node, then division, then a third candidate never offered before
- 223-249 intersection (4, 0); perpendicular foot (1, 0); extension (6, 0) from the end (4, 0); parallel to a 14° wall; suite closes (line 250 blank)

## Contracts, state and data flow
- snap is pure. The reach scales with mpp; candidates are ranked (points before bodies, ends and middles before body, guides crossing before body), and a skip list cycles through them. Tab is the real key for that (input.ts nextSnap); this differs from the keyboard-select test's stale Tab mention (F-0135).

## Depends on / used by
- uses: src/tools/snap, src/core/vector
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/SQRT2 : the constant √2 used for the arc's 315° point (line 165)
- https://en.wikipedia.org/wiki/Vector_projection : the foot of the cursor on a line is its projection (lines 19-24, 231-235)
