# tests/elements/opening/void.test.ts
Lines: 150
Summary: Tests the void openings cut in a wall, by hand: plan areas of the cut pieces and volumes of the 3D blocks, on a 4 m concrete wall 20 cm thick and 2.80 m high (0.80 m² in plan, 2.24 m³). Each case's expected area and volume:
- No opening: one block.
- A centred window: plan 0.56 in two pieces, volume 1.952; empty in the hole, solid once under the sill, over the head and beside it.
- A door from the floor: plan 0.62, volume 1.862.
- A door and a window together: volume 1.574.
- A three-layer masonry wall: every layer cut, giving six pieces.
- An L corner keeps its miter.
- A base offset raises the hole with the wall.
- A window too tall: warned, and the hole stops at the wall's top.
- An opening past the end: warned, and the wall is not cut at all.
- A reversed wall: the opening is still measured from its own start.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: plan areas and block volumes, the base wall worked by hand
- 4-9 imports: vitest, document, deriveGeometry, area, newOpening/Opening, insidePolygon (a second import from the same module)
- 11-23 wall helper and docWith
- 25-41 measure: sums piece areas and block volumes (area × height), counts blocks, and cover(x, y, z) counts the blocks containing a point (strictly between bottom and top, inside the polygon)
- 43-52 the bare wall: 0.8, 2.24, one block
- 54-82 centred window: plan 0.56 in 2 pieces; volume 1.952; hole empty; under, over and beside covered once; opening valid, from 1 to 2.2
- 84-107 door fromStart 0.5: 0.62 and 1.862, empty down to 0.01; door plus window: 1.574, plan 0.38, the cover checks
- 109-115 masonry 15 with three layers: 0.42 in 6 pieces, and its volume
- 117-120 an L corner with a door: plan 1.22
- 122-128 base offset 0.5: volume 1.552; the hole starts at 1.5
- 130-136 sill 2.0: volume 2.048, invalid, openingTooTall listed
- 138-142 fromStart 3.5 (past the end): no cut, openingOutside
- 144-149 a wall drawn backwards: the hole near x 3.1, solid near 0.9; suite closes (line 150 blank)

## Contracts, state and data flow
- deriveGeometry gives each wall's plan pieces (cut through by every opening) and its 3D blocks (around the hole). Openings that are invalid for being outside the wall do not cut it.
- cover tests points away from edges, so insidePolygon's boundary handling does not decide any result.

## Depends on / used by
- uses: src/app/document, src/app/geometry (deriveGeometry, insidePolygon), src/elements/wall/geometry/convex, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Point_in_polygon : the even-odd ray test, and how points on or near the boundary depend on the algorithm's details (cover, line 39)
