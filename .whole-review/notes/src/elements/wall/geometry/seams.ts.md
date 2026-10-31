# src/elements/wall/geometry/seams.ts
Lines: 138
Summary: Plan lines between layers (where pieces of different layers share a side), and the outer sides of a set of pieces (the finished faces a tape measures to). Lines inside one layer are left out, so a core running through a joint reads as one.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: lines between different layers only; pure; derived once per geometry
- 6 import: the Point2 type
- 8-18 SeamPiece (wall, polygon, layer key) and Seam (a segment)
- 20 TOL 1e-7: the collinearity and overlap tolerance
- 22-39 layerSeams: bounding boxes, every pair (box overlap test, no spatial index) with different keys, their shared sides given to the first piece's wall
- 41-45 outerSides doc: every part of a side no other piece shares, parts of one line joined
- 46-83 outerSides: per side, the spans covered by sides of other pieces on the same line (box-filtered), the uncovered parts kept
- 84-115 parts on one line that touch or overlap merged into one segment (repeated passes until nothing grows)
- 117-137 sharedSides: overlaps of collinear sides of two polygons, as segments (direction reversed relative to p)

## Contracts, state and data flow
- Pure. Pair loops with an AABB test only (broad phase without a spatial structure): fine at house scale, quadratic as pieces grow; outerSides' merge loop is cubic in parts at worst.

## Depends on / used by
- uses: core/vector (type)
- used by: the plan renderer (layer lines between pieces), dimensions and wall stops that measure to finished faces (outerSides)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection : AABB overlap test and a broad phase (R-tree, spatial hash) for many objects (lines 24-34, 47-66)
