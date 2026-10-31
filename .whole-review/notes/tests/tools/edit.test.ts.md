# tests/tools/edit.test.ts
Lines: 151
Summary: Tests of moving, stretching and rotating walls while keeping their joins, every point worked by hand on an 8 × 6 room with a divider:
- moving a wall drags the corners it shares, so the room stays closed;
- an abutting divider slides along its own line to stay on a moved host;
- a top wall moved up and across keeps square corners;
- moving everything moves each wall once;
- unrelated walls are left alone;
- stretching an end moves the ends meeting it, and a lengthened host keeps its abutting walls;
- rotating one wall, or the whole room, keeps corners, and a rotated wall drags its shared corner;
- stretching along a wall moves the end to the cursor's foot on the wall line;
- walls on another level are never joined.
Every neighbour in these cases is square to the moved wall. No case has a neighbour nearly in line, which is the case that throws the neighbour far away (F-0101).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: corners follow, abutting ends slide
- 4-7 imports: vitest, newDocument/DocWall, vec, moveWalls/rotateWalls/stretchAlong/stretchEnd
- 9-18 wall helper (15 cm masonry)
- 20-31 the 8 × 6 room and the divider d at x 4; byId
- 33-38 d moved by (1, 0): (5, 0)–(5, 6)
- 40-46 w1 moved by (2, 0): w0's end and w2's start follow to x 10
- 48-53 w2 moved by (0.5, 1): d's top end slides along x = 4 to (4, 7)
- 55-66 the same move: the side walls stay at x 8 and 0 and stretch to 7; w2 runs between them
- 68-72 all walls moved by (1, 1): each once
- 74-78 a far wall is identical after the move; suite closes
- 80-87 stretchEnd w1's end to (9, 7): w2's start follows; w1's start stays
- 88-93 stretching w0 to x 10 leaves d at x 4; suite closes
- 95-106 rotate d 90° about (4, 3): (7, 3)–(1, 3)
- 108-113 the room rotated 90° about the origin: corners kept
- 115-119 w1 rotated about (8, 0): w2's start follows to (2, 0)
- 121-127 stretchAlong w0 toward (10, 3): the end goes to (10, 0), the corner follows; suite closes
- 129-142 an upper-level wall u on w1's line: moving u leaves w0 and w1 unchanged
- 144-150 dragging u's start leaves the corner below; suite closes (line 151 blank)

## Contracts, state and data flow
- moveWalls, stretchEnd, rotateWalls and stretchAlong return new wall lists. Ends on the moved walls follow by lines meeting, which is where an unguarded intersection of nearly parallel lines produces a point far away (F-0101, edit.ts:79). Joins are only made within a level.

## Depends on / used by
- uses: src/app/document, src/core/vector, src/tools/edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0101 (Also: no near-parallel neighbour case)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection : intersection by determinants; the denominator is zero for parallel lines, so a tiny one gives a far point (lines 48-53: ends slide by intersecting lines)
