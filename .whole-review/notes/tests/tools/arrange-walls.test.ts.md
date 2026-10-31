# tests/tools/arrange-walls.test.ts
Lines: 66
Summary: Tests of aligning and distributing parallel walls, worked by hand on a 9 × 3 m box with partitions at x = 2, 3 and 7.
- Distributing: the outer two walls stay and the middle one moves halfway (2, 4.5, 7), whatever order they were picked in. A moved wall still stands on the bottom and top walls, its ends sliding along them. Distributing needs three parallel straight walls.
- Aligning: the others move onto the first wall picked (p3 and p7 onto x = 2). A wall that is not parallel, or an arc, makes the command refuse (null).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: align and distribute, worked by hand
- 3-5 imports: vitest, document, align/distribute and their can-checks
- 7-15 wall helper with an optional bulge
- 17-30 the box b, r, t, l and partitions p2, p3 (drawn downward) and p7; xOf()
- 32-41 distribute picked as [p7, p3, p2]: x 2, 4.5, 7; p3's ends at y 3 and 0
- 43-49 two walls or a non-parallel one: false and null; three partitions: true
- 51-57 align onto p2: all at x 2 (three walls stacked on one line; overlap not checked here)
- 59-65 p2 with b: false and null; with an arc: false; suite closes (line 66 blank)

## Contracts, state and data flow
- Pure: it returns the new wall list or null, and the caller dispatches it. Spacing is measured along the common normal between parallel lines.

## Depends on / used by
- uses: src/app/document, src/tools/arrange-walls
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Parallel_(geometry) : the distance between parallel lines is measured along a common perpendicular (lines 32-41)
