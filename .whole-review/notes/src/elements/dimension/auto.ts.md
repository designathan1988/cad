# src/elements/dimension/auto.ts
Lines: 87
Summary: Automatic dimensioning (pure): for each straight wall of the level (or the walls given), on its outer face (no room behind), a chain from corner to corner through every door and window jamb and the wall's overall length past it, each end held by what it measures, stacked past dimensions already on that side.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: Revit/ArchiCAD auto dimensions; ends held so the chain follows walls and doors; outer face = no room behind; walls with rooms both sides only when named
- 7-12 imports: Doc, DerivedGeometry, vector, insideRing, placeDimension, DIM_PREFIX/DimAnchor/Dimension
- 14-16 CHAIN_OFF 0.6 m, TOTAL_OFF 1.1 m
- 18-25 autoDimensions: the level's enclosed rooms; a point-in-room test
- 26-38 per straight wall (named or all), its blocks' points; across and along from the wall's start; the left and right extremes across
- 39-46 a probe 25 cm past each face at the wall's middle: the free face (left preferred); none free and not named → skipped
- 47-52 the face's corners (points within 0.1 mm of the face): the extreme stations; an anchor from the nearer end at the face's offset
- 53-67 stops: the two corners and every valid opening's jambs between them, sorted, repeats within 0.1 mm dropped
- 68-78 dimensions already on this wall (both ends on it or its openings), including those made in this run: the farthest out on this side
- 79-84 the chain (when there are openings) at +0.6 m past them, and the overall at +1.1 m (+0.6 m alone), sharing a chain id
- 85-86 all the dimensions made are returned

## Contracts, state and data flow
- Pure; ids made by the caller's function.
- The probe at the wall's middle decides the outer face: a room touching only part of the face's length is missed or caught depending on whether it covers the middle.

## Depends on / used by
- uses: core/vector.ts, elements/room/derive.ts (insideRing), elements/dimension/anchor.ts, schema.ts, app types
- used by: app/actions.ts or app.ts (dim.auto)

## Problems found (finding IDs)
- none

## To check in other files
- the dim.auto action: walls given (selection) or all

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap : map then flatten one level (line 33)
