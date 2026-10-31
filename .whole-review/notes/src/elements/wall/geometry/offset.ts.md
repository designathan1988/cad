# src/elements/wall/geometry/offset.ts
Lines: 56
Summary: Plan helpers for a straight wall: direction, left normal, length, face offsets (exterior on the right, smaller first), end points, the direction into the body from an end, face lines, signed offset and station of a point, and the band (strip) between two offsets lengthened past the ends.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the exterior face is on the right of the drawing direction
- 3-6 imports: vector ops, WallEnd, ConvexPolygon, WallShape
- 8-11 Line: a point and a direction
- 13-15 wallDirection (unit start → end), wallNormal (left perpendicular), wallLength
- 17-20 faceOffsets: first and last layer offsets, exterior first
- 22 endPoint: the start or the end point of the wall
- 24-28 intoBody: from an end into the wall
- 30-32 faceLine: the line at an offset
- 34-38 offsetOf (signed distance along the unit normal) and stationOf (distance along the wall from the start)
- 40-55 strip: four corners from start − ext·d to end + ext·d at the two offsets, counter-clockwise when o0 < o1

## Contracts, state and data flow
- Pure. A zero-length wall would give a NaN direction; shapes reject degenerate walls before (shape.ts).

## Depends on / used by
- uses: core/vector, wall/schema (type), wall/geometry/convex and shape (types)
- used by: wall/geometry/footprint.ts and join resolvers, opening/void.ts (faceOffsets, wallDirection), wall-stops and dimension code

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line : distance as the projection onto a unit normal; without the absolute value it is signed (line 35)
