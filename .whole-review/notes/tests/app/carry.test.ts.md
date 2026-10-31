# tests/app/carry.test.ts
Lines: 58
Summary: Tests that a room goes with its walls: all walls moved → both rooms move; the left room's four walls (with the shared one) → only it moves; one wall → none; and the walls around a room are those whose pieces touch its outline (none when it is open).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a room moves when every wall around it does
- 4-7 imports: vitest, carriedRooms/wallsAround, document, deriveGeometry
- 9-18 wall helper: a concrete 20 centreline wall on the ground
- 20-32 two rooms side by side sharing x = 4; a +10 shift
- 34-48 carriedRooms: all walls, the left room's walls, one wall
- 50-57 wallsAround: the left room's four walls; none when a wall is removed (open)

## Contracts, state and data flow
- Pure: rooms keep seeds, moved only when wholly surrounded by moved walls.

## Depends on / used by
- uses: src/app/carry, src/app/document, src/app/geometry
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#toequal : recursive structural equality (lines 37-55)
