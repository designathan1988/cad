# tests/app/temp-dims.test.ts
Lines: 170
Summary: Tests of temporary dimensions: a wall's length (typing stretches it and drags the corner, 0 refused, several selected show none); an opening's distances to the meeting wall's face or the end on each side, to a partition's face, typed values stored as fromStart/fromEnd; an opening measured from another shows the gap and keeps its fromOpening rule (RC2's hidden links pinned); an arc's chord and radius (typing keeps the sweep or the ends); the length placed on the side free of Ts; the clear gap to a parallel wall, typed to move the wall with its corner following.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 imports: vitest, document, geometry, tempDims, vec, newOpening
- 8-17 wall helper with vec points
- 19-25 two walls (an L) and a door 1 m from the start (worked distances in the comment)
- 27-36 a wall's length and typing 8 (end and the neighbour's start move)
- 38-44 the door's two distances (1 from the end, 4 to the inner face at 5.9)
- 46-57 a partition at 3.5: 1.5 to its face; typing 0.6 stores fromEnd 6 − 3.4 + 0.6
- 59-66 typed distances from each end become fromStart / fromEnd
- 68-72 zero refused; several selected: none
- 74-103 an opening measured from another (toward end and start): the gap shown and typing keeping fromOpening (F-0068 Also)
- 105-134 an arc: chord and radius dimensions (radius at 30 % of the sweep); typing a chord keeps the sweep, a radius keeps the ends (tan π/12 for radius 2), too small refused
- 136-145 the length on the side away from a T
- 147-162 the gap to a parallel wall (2.80), drawn mid-overlap, typed 2.50 moves w0 0.30 and its corner neighbour follows
- 164-169 no gap for a non-overlapping wall or one on another level

## Contracts, state and data flow
- Each dimension carries apply(value) → a Command or null; the tests run the commands on the doc.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/app/temp-dims, src/core/vector, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0068 (Also): these tests pin fromOpening links and face-measured stations

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tan : tan in radians; tan(π/12) = 2 − √3, the bulge of a 60° arc (radius 2 on a 2 m chord) (line 131)
