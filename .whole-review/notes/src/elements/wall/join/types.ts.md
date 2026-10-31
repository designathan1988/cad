# src/elements/wall/join/types.ts
Lines: 95
Summary: Types of the join engine: how an end is trimmed (extension, common cuts, per-layer cuts), notches, warning kinds and warnings, corners (L), crossings (X), nodes (three or more ends), abutments (T), junctions (several at one point) and the join graph.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 imports: Point2, HalfPlane, EndRef and WallId types
- 5-13 EndCut: extension, cuts for every layer, layerCuts per layer
- 15-22 Notch: wall, convex region (all half-planes hold), first and last layer
- 24-37 JoinWarningKind (wallsOverlap, complexJoin, arcJoinUnsupported, wallTooShort, missingWallType, invalidWallType, arcTooTight) and JoinWarning
- 39-46 Corner: two ends and the node (midpoint, or the axes' crossing when they overran)
- 48-54 Crossing: through wall, cut wall, point
- 56-60 JoinNode: ends and point
- 62-65 Abutment: the abutting end and the host
- 67-85 Junction: point, passing walls, ends, the joins it absorbs, onWall
- 87-94 JoinGraph: corners, nodes, crossings, abutments, junctions, warnings

## Contracts, state and data flow
- Types only (readonly at compile time, nothing enforced at runtime).

## Depends on / used by
- uses: core/vector, wall/geometry/convex, wall/schema (types)
- used by: every wall/join module, wall/geometry/footprint.ts, app/geometry (warnings shown)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/2/objects.html : readonly properties, arrays and tuples are compile-time checks only (lines 9-94)
