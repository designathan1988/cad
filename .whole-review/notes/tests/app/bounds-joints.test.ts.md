# tests/app/bounds-joints.test.ts
Lines: 81
Summary: Tests of selection bounds (a room inside its walls, an outline floor) and of opening warnings: an opening spanning another wall's T is flagged openingAtJoint, one beside it is not; two doors whose leaves sweep the same floor are both flagged and invalid, but not when one opens outward.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: floating bar bounds and openings over joints
- 4-7 imports: vitest, document types, boundsOf/deriveGeometry, newOpening
- 9-18 wall helper (concrete 20, centreline, ground level)
- 20-25 a 4×3 box of walls, a room in it, an outline floor beside
- 27-37 bounds: the room's outline inside the walls (0.1 / 2.9), the floor's outline box
- 39-53 opening over a joint: a T at x = 2; a centred 1.20 window covers it (flagged, listed); one 0.5 from the end is not
- 55-80 two doors near the corner sweeping into the room: both flagged openingSwingClash and invalid; opening outward: neither

## Contracts, state and data flow
- Pure derivations; the expected warning kinds and invalid flag document opening validity.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobecloseto : toBeCloseTo with a digit count; toContainEqual deep-compares array items (lines 30-72)
