# src/elements/wall/geometry/under-roof.ts
Lines: 134
Summary: Walls whose top follows the roofs over them (Revit's Attach Top). It builds the roofs' undersides as convex pieces under planes (a flat roof's outline by ear clipping), finds the highest underside over a polygon, and cuts a wall block by the roof pieces: sloped parts take the plane, parts above the block's top stay flat, uncovered parts keep the wall's bare top.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: tops follow the roofs' undersides; gables rise to the ridge; uncovered parts keep the level's top; pure
- 6-9 imports: Point2, RoofSolid, Block, convex helpers
- 11-18 TopPlane (z = a·x + b·y + c) and planeAt
- 20-23 RoofCover: convex pieces each under one plane
- 25-28 planeOf: a plane from a height function sampled at three points
- 30-38 regionOf (ccw polygon as half-planes) and clipTo
- 40-64 triangles: ear clipping of a simple polygon (ccw), with a guard; collinear points inside a candidate ear block it (`>= 0`); stops when no ear is found
- 66-75 roofCovers: each face under its plane; a single flat face triangulated (its outline need not be convex)
- 77-86 highestUnder: the highest underside over a polygon, null where none covers
- 88-133 blocksUnder: for each roof in order, the parts of the block under each piece: flat plane caps the top; sloped plane keeps the parts above the bottom, sloped below the block's top and flat above it; what a roof leaves uncovered goes to the next roof (the first roof in the list claims an overlap, not the lowest); the rest keeps the bare top

## Contracts, state and data flow
- Pure. Roof faces are the underside planes from roof/geometry.ts (thickness added on top). Covers are computed per level from roofSolid with the level's top, and cached by the roof in app/document.ts (stale on level changes: F-0013).
- Non-convex sloped roofs come in flat (F-0081), so walls under them stop at the eaves.

## Depends on / used by
- uses: core/vector (type), roof/geometry (type), opening/void (Block type), wall/geometry/convex
- used by: app/document.ts (roofCoversOf, wallHeights for walls topped by the roof), the wall 3D blocks (blocksUnder), wall/geometry/edges.ts (SlopedTop)

## Problems found (finding IDs)
- none new (overlapping roofs: first wins, noted)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Polygon_triangulation : ear clipping, O(n²), works on simple polygons without holes (lines 40-64)
