# src/elements/wall/geometry/edges.ts
Lines: 265
Summary: The feature lines drawn over walls in 3D. Visible side faces are grouped by plane (direction and offset), the outline of each plane's union of rectangles gives the lines, and vertical lines between sides turning less than 15° (arc segments) are dropped, with corners deduplicated. A second pass handles walls with sloped tops (under a roof): lines above a block's slope inside it are cut, and the slope's line is drawn on each visible side.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-10 header: lines where the surface turns; seams inside a plane draw nothing; arc segments left out; tops and bottoms add nothing (their edges are sides' edges); timing note
- 12 import: Prism and PrismFaces types
- 14-24 Point3 and Edge3
- 26-30 TOUCH 1e-4 (same plane), SMOOTH 15°, LENGTH_EPS
- 32-45 Rect (along-plane and height span) and Plane (normal, offset, rects)
- 47-68 featureEdges setup: planes bucketed by rounded normal and offset with the neighbouring buckets searched
- 69-88 every visible side rectangle of every block put on its plane (outward on the right of a ccw edge), in along-plane coordinates
- 89-104 per plane: the outline's horizontal runs as edges; vertical runs collected by plan point
- 105-117 each vertical run less the heights where a side turning under 15° meets it there (arc segments)
- 118-127 edges deduplicated by rounded end points (a corner from both sides once)
- 129-140 Run; levels (sorted, merged within LENGTH_EPS)
- 142-180 outline: the grid of all rectangle sides; a cell covered when some rectangle holds its middle (each test scans all rectangles); horizontal and vertical runs between covered and uncovered cells, joined while in line
- 182-193 less: an interval minus cuts
- 195-200 SlopedTop: polygon, top plane z = a·x + b·y + c, faces
- 202-243 underSlopes: each edge clipped against each sloped block (inside in plan with a hair of slack, and above the slope) and the parts kept
- 244-264 the slope's line along each visible side of each sloped block

## Contracts, state and data flow
- Pure. Blocks must be counter-clockwise; levels go in separate calls (each drawn lifted on its own).
- Cost: outline's covered() scans every rectangle for every grid cell (rectangles² × rectangles per plane in the worst case); fine for houses, grows fast on long façades split by many openings.

## Depends on / used by
- uses: wall/geometry/faces (types)
- used by: the 3D wall rendering (render/scene-3d through app/geometry)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://threejs.org/docs/pages/EdgesGeometry.html : three's own edge lines are drawn where adjoining face normals differ by more than a threshold angle (default 1°); this file applies the same idea per plane with 15° (lines 28-29, 105-117)
