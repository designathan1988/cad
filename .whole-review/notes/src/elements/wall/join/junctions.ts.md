# src/elements/wall/join/junctions.ts
Lines: 142
Summary: Walls at one point beyond a single L, T, X or node (§7.6) become one junction: crossings near one point, an end on a crossing, an end inside an L's corner or a node, or ends meeting at one point inside a wall that goes on. Every passing wall gives two arms and every end one; footprint.ts then cuts each arm's sector.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: discovery sees pairs alone; here they become one junction, arms to sectors
- 7-12 imports: vector ops, offset helpers, WallShape, parentOf, EndRef, join types
- 14-15 hubOf: a quarter of the thinnest wall
- 17-23 wellInside: inside a wall's band an eighth of its thickness clear of both faces
- 25-29 onLine: a point's foot on a wall's reference line
- 31-40 gatherJunctions setup: straight walls only (arcs never join a junction), end points, taken abutments
- 41-59 straight crossings unioned when closer than the thickest wall there; groups by root; centre and passing walls
- 60-67 a group is one junction when its points nearly coincide (hub) or its centre is well inside every passing wall; else each X alone
- 69-87 per group: abutments, corners and nodes in the hub (or with an end inside two passing walls) absorbed; a junction when there is more than a single crossing
- 89-115 an abutting end inside an L's corner or a node (inside two of its walls, within the thickest's thickness): the corner or node grows an arm; one junction each
- 117-134 corners and nodes whose point lies well inside another straight wall away from its ends: that wall passes whole (onWall) and the ends meet outside its face; its abutments absorbed
- 136-141 awayFromEnds: clear of both ends by the wall's thickness

## Contracts, state and data flow
- Pure. Tests `'node' in host` to tell a Corner (has node) from a JoinNode (has point).
- Arcs are left out of every junction: an arc in such a meeting goes through the pairwise resolvers (and their warnings).

## Depends on / used by
- uses: core/vector, wall/geometry (offset, shape, arc), wall/schema, wall/join/types
- used by: wall/join/discover.ts (gatherJunctions), wall/geometry/footprint.ts (onLine, junction resolution)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in : `in` is true for own or inherited properties, and TypeScript narrows unions with it (lines 105, 111-112, 122, 129-130)
- https://en.wikipedia.org/wiki/Disjoint-set_data_structure : union-find with path compression (lines 45-55; opened for discover.ts, same structure)
