# tests/elements/opening/distribute-house.test.ts
Lines: 48
Summary: Tests windows distributed in a real house: a 9 × 4.6 rectangle of 15 cm walls, split into two rooms by a T wall at x = 4.6. Three windows sit on the bottom wall. In the right room, the spaces are equal between the T wall's face and the corner wall's inner face. A member later given its own position (dragged) leaves the other two exactly where they were. Both cases come from user reports.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: equal spaces between the faces the room sees; a dragged member moves alone
- 5-10 imports: vitest, the document, hostsIn, distributeOpenings/updateOpening, deriveOpenings, newOpening
- 12-21 wall helper: 15 cm masonry wall on its centreline
- 23-27 the house: four outer walls and the T wall m; windows x, y and z on wall b at stations 2, 5.5 and 7.5; a placed helper using hostsIn (stops included)
- 29-38 distributing all three: in the right room, the gaps from the T face 4.675 to y, from y to z, and from z to the inner face 8.925 are equal (6 digits)
- 40-47 y given fromStart 5: x and z keep their starts (9 digits); suite closes (line 48 blank)

## Contracts, state and data flow
- Distribution works within each room's span, found from the hosts' stops: the T wall splits the bottom wall into two runs. Window x is in the left room and its position is not checked here.
- Updating one member's rule dissolves the group (see arrange.test 157-165) and keeps the others' stations.

## Depends on / used by
- uses: src/app/document, src/app/geometry (hostsIn), src/elements/opening (commands, derive, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring : array destructuring binds by position (line 33)
