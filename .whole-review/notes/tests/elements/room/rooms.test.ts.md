# tests/elements/room/rooms.test.ts
Lines: 104
Summary: Tests of rooms and floors, each area worked by hand from the walls' faces, in an 8 × 6 ring of 20 cm walls.
- A seed inside the ring gives the inside of the faces: 45.24 m², perimeter 27.2 m.
- The room's label sits at the middle of the room as it is now, and moves when a wall moves.
- A 15 cm divider splits the space: the left room is 22.185 m².
- A seed outside the ring, or inside a wall, gives a room that is not enclosed, with a warning.
- Two rooms in one space name each other and are both warned.
- The room follows its walls when one moves.
- Floors: one linked to a room takes the room's outline (45.24 m², from 0 down to −0.15); one drawn by outline keeps its own (6 m²).
- Deleting a room turns its floor into an outline at the same place.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: areas worked by hand from the faces
- 3-9 imports: floorsOf, vitest, document, deriveGeometry, vec, deleteElements, moveWalls
- 11-20 wall helper with a type
- 22-25 the 8 × 6 ring (inside 0.1 to 7.9 by 0.1 to 5.9), a room builder, doc()
- 27-33 enclosed, area 45.24, perimeter 27.2
- 35-44 seed (1, 1) puts the label at (4, 3); after the right wall moves 2 m, label x is 5
- 46-51 divider at x 4 (faces 3.925, 4.075): area 3.825 × 5.8
- 53-59 'out' and 'in' (in a wall) not enclosed, both warned, sharing nothing
- 61-67 a and b in one space share each other and are warned roomShared; c (outside) shares nothing
- 69-74 moveWalls on w1 by 2 m: area 9.8 × 5.8; suite closes
- 76-91 floors f1 (room) and f2 (outline): areas 45.24 and 6; f1 top 0, bottom −0.15
- 93-103 deleteElements(['r']): rooms empty, f1's source now an outline, area 45.24; suite closes (line 104 blank)

## Contracts, state and data flow
- Rooms are derived from the seed and the level's walls each time (areas via a polygon area sum). Free-standing walls inside a room are not tested (F-0073).

## Depends on / used by
- uses: src/elements/registry (floorsOf), src/app/document, src/app/geometry, src/core/vector, src/elements/opening/commands (deleteElements), src/tools/edit (moveWalls)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0073 not covered by these cases)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Shoelace_formula : a polygon's area from its vertices; positive for counter-clockwise order (areas at lines 31, 50, 72, 87, 90)
