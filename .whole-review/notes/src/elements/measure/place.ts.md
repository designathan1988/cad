# src/elements/measure/place.ts
Lines: 91
Summary: Where a measure stands now (pure): an angle's arc between its arms the short way, an arc wall's circle at its reference line or a face (none once the wall is gone or straight), a coordinate's point and label; where along an arc a point falls; and the arc wall under a point with its nearest line, for the measure tool.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: placements from the document; the arc wall under a point; pure
- 5-10 imports: Doc/DocWall, Point2, arcOf, shapeOf, angleBetween/ArcFace/Measure
- 12-18 PlacedArc: centre, radius, start angle, signed sweep
- 20-23 Placed: angle (vertex, radius, start, sweep, value, arm lengths), arc measures (arc, angle at, value), coordinate
- 25-34 wallArc: the wall's shape and arc; the exterior face = first layer offset, interior = last, reference = 0; radius moved by turn × offset; none when not positive
- 36-43 alongArc: the point's angle from the start in the sweep's direction, wrapped into [0, 2π), as a fraction of the sweep; outside it → null
- 45-57 placeMeasure angle: the angle's value (none when zero); the short way from arm a to arm b (−π, π]; arm lengths
- 58-64 coordinate as stored; an arc measure on its wall's line: radius, diameter or length, the leader at t along the sweep (clamped 0..1)
- 66-90 arcWallAt: per arc wall of the level, its three lines; the point's place along the first line's sweep; within the faces' radii ± near; the nearest line; the nearest wall

## Contracts, state and data flow
- Exterior is the first layer side, as elsewhere (the right of the wall's direction).

## Depends on / used by
- uses: elements/wall/geometry (arc, shape), elements/measure/schema.ts, app/document.ts (types)
- used by: elements/kinds/measure.ts (placeMeasure), app/kind-tools.ts (arcWallAt)

## Problems found (finding IDs)
- none

## To check in other files
- elements/measure/schema.ts angleBetween

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : atan2(y, x) in [−π, π], y first (lines 38, 49-50)
