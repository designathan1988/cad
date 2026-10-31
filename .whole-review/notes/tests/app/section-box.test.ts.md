# tests/app/section-box.test.ts
Lines: 131
Summary: Tests of the 3D section box and the vertical section: face centres and normals, moving a face (never past the other, MIN_BOX), the first box around the model with a margin, twelve axis-aligned edges, the on-screen drag in metres, reading a box back; the cap fills where the box cuts walls (none, a side face, the top face, one stretch per arm of an L or U); a vertical section line's look direction, its caps across a wall (straight and diagonal), none past it, and reading it back with a unit direction.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: faces, moving one, the first box, the drag; by hand
- 3-4 imports: vitest, section-box functions and types
- 6 the sample box: 4 × 2 × 3 m from the origin
- 8-48 the box: faces, moveFace, boxAround, boxEdges, dragDistance, readBox
- 50-92 boxCaps against a 4 m wall and an L/U: none, a side cut, top and side cuts, stretches per arm
- 94-130 the vertical section: looks left (expects -0 for x), caps across, diagonal length 0.2·√2, none past, readSection normalised or null

## Contracts, state and data flow
- Pure geometry; the expectation of `{ x: -0, y: 1 }` (line 98) ties the test to the sign of a zero.

## Depends on / used by
- uses: src/app/section-box
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#toequal : toEqual compares structure recursively; toBe is Object.is (lines 10-129)
