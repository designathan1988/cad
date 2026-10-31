# tests/app/pick.test.ts
Lines: 55
Summary: Tests of picking in plan: a wall on its body; 4 cm off its face only with the reach, the nearest wall winning, none farther; a door taken by a point 2 cm off its drawn leaf or swing (inside the room) only with the reach, while no wall is taken there.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a 4×3 box of 20 cm walls; the bottom wall's body spans y −0.1 to 0.1
- 4-8 imports: vitest, document, deriveGeometry/openingAt/wallAt, newOpening, symbolLines
- 10-17 wall helper: a concrete 20 centreline wall on the ground
- 18-25 the box, a door 0.5 m from the bottom wall's start, geometry, 6 cm reach
- 27-39 walls: body, off the face with and without reach, nearest, none
- 41-54 the door by its symbol's farthest point (reduce over all symbol points), taken with reach only, no wall there

## Contracts, state and data flow
- Pure hit testing on derived geometry.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening/schema, src/elements/opening/symbol
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce : reduce without an initial value starts from the first element and throws on an empty array (lines 45-47: the door's symbol has points)
