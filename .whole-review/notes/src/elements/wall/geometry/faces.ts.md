# src/elements/wall/geometry/faces.ts
Lines: 159
Summary: Which faces of the walls' 3D blocks show. Blocks are disjoint convex prisms. A side face is hidden where another block's side lies on the same line facing it over the same heights; a top or bottom is hidden where another block's bottom or top lies on it. Decided by geometry alone.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 header: blocks disjoint; touching faces are inside; what is left is outside; decided by the geometry, not join tags
- 11-13 imports: AREA_EPSILON, Point2, convex helpers
- 15-35 Prism (convex polygon, bottom, top), FaceRect (along an edge and in height), PrismFaces (visible side rectangles per edge, visible top and bottom parts)
- 37-39 TOUCH 1e-4 m, LENGTH_EPS
- 41-45 regionOf: a convex polygon as half-planes
- 47-80 subtract: a rectangle less cut rectangles on the grid of their edges (each cell tested against every cut), rows of the same span merged upward
- 82-88 Edge: prism, index, start, direction, length
- 90-121 visibleFaces: edges bucketed by line (direction folded to half a turn, signed offset, rounded, neighbours searched)
- 122-146 per edge: facing edges of other prisms on the same line give cut rectangles over the common span and heights; the side's visible rectangles
- 147-158 caps: each prism's top less every prism whose bottom is at that height (and bottom less tops), by clipping out their regions (all pairs: O(n²) clips, not bucketed)

## Contracts, state and data flow
- Pure. Inputs ccw convex prisms; outputs per prism in the same order (edges.ts relies on it).
- Cost: sides are bucketed, caps are not. Every prism is compared with every other at the same height, and many walls share sill and head heights.

## Depends on / used by
- uses: core/tolerance, core/vector (type), wall/geometry/convex
- used by: wall/geometry/edges.ts, the 3D wall meshes (render through app/geometry)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm : clipping by a convex region one half-plane at a time (lines 41-45, 148-155 through convex.ts clipOut)
