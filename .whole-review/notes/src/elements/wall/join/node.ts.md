# src/elements/wall/join/node.ts
Lines: 319
Summary: Three or more wall ends at one point. The pair closest to in line (within 10°) is the passage and joins as an L, and every other end abuts it as a T where that is exact: against one passage wall alone, against both when they show the same lines, or against the corner's outside. With no in-line pair, more than four ends, an end the passage cannot take, or two ends on one side, every arm takes its sector. A complexJoin warning is given where neither is exact.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: §7.4 passage rule and §7.6 sectors; complexJoin only where neither is exact
- 8-19 imports: tolerances, vector ops, convex helpers, offset helpers, WallShape, schema types, parentOf, resolveCorner, resolveAbutment, goesThrough, resolveSectors, join types
- 21-22 PASSAGE_ANGLE: 10° from in line
- 24-35 NodeResult, End, angleBetween (atan2 of |cross| and dot)
- 37-50 resolveNode: ends sorted by id and end; sectors for straight walls only
- 51-59 no in-line pair or more than four ends → sectors (or complexJoin past four); else the passage pair (or the thickest pair) and the others
- 61-68 the passage as an L (resolveCorner), its cuts, notches and warning
- 70-93 each other end: an arc end from outside the corner; alone against one passage wall; matching both; or against the corner's outside (then on the faces); else complexJoin
- 94-102 complexJoin, two ends on one side, or ends only on the faces → sectors when exact
- 103-107 two ends on one side not resolved → complexJoin; the result
- 109-123 inLinePair: the pair whose bodies are closest to opposite, within 10°
- 125-130 thickestPair: the two thickest cores (goesThrough order)
- 132-146 layerBodies: a passage wall's layers as this node cuts them
- 148-153 regionOf: a convex polygon as half-planes
- 155-161 nearFace: the host's face toward the abutting wall and the half-plane beyond it
- 163-175 nearFacePoints: the abutting wall's faces on that face
- 177-182 holds and withinLength helpers
- 184-201 alone: the T against one passage wall when everything stays on its side of the passage cut, within its length, and the rest misses the other passage wall's layers
- 203-260 matching: a passage in line whose two walls show the same face lines on that side (within an area tolerance over the zone): one cut, both notched; with other finishes between, each layer cut by the wall it meets, the core required at one line
- 262-275 layerFacePoints and far helpers
- 277-299 outside: the third end coming from the reflex side keeps its end and is notched by both passage walls' layer bodies (starts on their faces)
- 301-318 sideLines: the host's layer boundaries on the abutting side, from the near face to the core face, with functions

## Contracts, state and data flow
- Pure. When a joint cannot be made exact, ends keep their square cut and a complexJoin warning is reported (the walls stay as drawn).
- Arcs never use sectors (straight only), so arcs at nodes fall back to the passage rule or a warning.

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry (convex, offset, shape, arc), wall/schema, wall/join (cut-l, cut-t, discover, sectors, types)
- used by: wall/geometry/footprint.ts (resolveNode for nodes not absorbed by junctions)

## Problems found (finding IDs)
- none (the known break "wall gone at a 3-end node" is to be reproduced in the app test and traced here and in sectors.ts)

## To check in other files
- src/elements/wall/join/sectors.ts: exactness checks that decide between sectors and complexJoin

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : atan2 range [−π, π]; with |cross| and dot it gives the unsigned angle robustly (line 35)
