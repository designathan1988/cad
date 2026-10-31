# tests/elements/dimension-constraints.test.ts
Lines: 201
Summary: Tests of locked and equal dimensions and of automatic dimensioning on a 4×3 box of 15 cm walls: locking keeps the current length; an unlocked dimension lets a moved wall go; a locked one drags the other wall (east moved → west follows, and the reverse), a wall's own locked length stretches it back, a window held by a lock slides along, an impossible lock is reported and nothing done; EQ chains move a partition to the middle and keep it there; auto dimensions along a wall's outer face (chain and total, offsets, past an existing one, following a moved window).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the box worked by hand
- 4-13 imports: vitest, document, geometry, placeDimension, auto dimensions, lock/EQ commands, equalChains/settleDimensions, Dimension, newOpening, moveWalls
- 15-39 wall helper, the box, an axis-to-axis dimension across, lengthOf, moved
- 41-113 locked dimensions: lock/unlock, unlocked lets go, both drag directions, own length, a window slid by a lock, an impossible lock refused
- 115-147 equal chains: EQ marks the chain and centres the partition, keeps it centred, EQ off
- 149-200 automatic dimensioning: south wall chain and total (1.075, 1.2, 1.875; 4.15), four walls give seven, stacked past an existing one, following the window

## Contracts, state and data flow
- These locks and EQ chains are explicit links the user makes and sees: the model RC2's fix wants for openings (F-0068), here already tested.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/dimension (anchor, auto, commands, constraints, schema), src/elements/opening/schema, src/tools/edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Geometric_constraint_solving : solvers place elements to satisfy distance and other constraints and detect over-constrained sets (lines 41-147)
