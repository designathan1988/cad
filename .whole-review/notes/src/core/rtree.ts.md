# src/core/rtree.ts
Lines: 85
Summary: A static R-tree packed once by sort-tile-recursive (16 entries a node) and queried for the boxes a box touches; plus the box around a set of points.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: static index, built again when what it indexes changes; queries cost depth plus results; pure (the header compares it with Flatbush, which packs by Hilbert order, not STR)
- 5-10 Box: minX, minY, maxX, maxY
- 12-16 Node: a box with children (inner) or item indices (leaf)
- 18-19 FAN: 16 entries a node
- 21-33 around: the box around boxes (Infinity/−Infinity when none)
- 35 touches: closed-interval overlap (boxes sharing an edge touch)
- 37-49 pack: sorted by centre x, cut into √(groups) vertical slices, each sorted by centre y and cut into runs of 16
- 51-64 RTree: no boxes → no root; leaves from the packed boxes (keeping their indices); levels packed until one node
- 66-78 search: a stack walk down the nodes touching q; leaves test each box
- 80-84 boxOf: the box around points, null for none

## Contracts, state and data flow
- Pure and static; indices refer to the boxes array given to the constructor.
- A box with NaN coordinates sorts inconsistently and never touches (comparisons with NaN are false): silently not found.

## Depends on / used by
- uses: nothing
- used by: app/geometry.ts and snapping/hit testing (spatial queries), tools/arrange.ts (boxOf?): to confirm by import map

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://github.com/mourner/flatbush : Flatbush is a static packed Hilbert R-tree with node size 16 by default (header lines 1-3, FAN 19)
