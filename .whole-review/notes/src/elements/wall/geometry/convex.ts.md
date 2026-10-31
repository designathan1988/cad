# src/elements/wall/geometry/convex.ts
Lines: 109
Summary: The project's only clipping primitives: half-planes (keep normal·p ≤ offset), signed area, counter-clockwise order, Sutherland–Hodgman against one half-plane with an on-line tolerance, the opposite half-plane, removing a convex region from a convex polygon as convex pieces, and the overlap area of two convex polygons.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: every piece convex, every cut a half-plane, so clipping is exact
- 4-5 imports: AREA_EPSILON, dot/Point2/vec
- 7-11 HalfPlane: keeps points with normal·p ≤ offset
- 13-14 ON_LINE 1e-11 m: a vertex this near the line is on it
- 16-17 ConvexPolygon: counter-clockwise, 3+ vertices, no repeated consecutive vertex (a type alias, not checked)
- 19-23 halfPlaneThrough(point, inward): normal = −inward, offset through the point
- 25-35 signedArea (shoelace, positive counter-clockwise) and area
- 37-39 toCounterClockwise: reversed when clockwise
- 41-47 doc of clipHalfPlane: on-line vertices kept, no crossing next to them (rounding of either sign caused micron-off vertices)
- 48-54 clipHalfPlane: the side of each vertex with the tolerance scaled by the normal's length
- 55-65 Sutherland–Hodgman: inside vertices kept; a crossing where the side strictly changes sign
- 66-68 the closing duplicate removed; less than 3 vertices or below AREA_EPSILON → []
- 70-74 opposite: the same line keeping the other side
- 76-90 clipOut: for each plane of the region, the part outside kept as a piece, the inside goes on (pieces are convex)
- 92-97 push (no consecutive duplicate) and same (exact equality)
- 99-108 overlapArea: a clipped by each edge of b (inward normal to the left of p→q, for counter-clockwise b)

## Contracts, state and data flow
- Correct for convex clip regions (Sutherland–Hodgman's requirement); a concave SUBJECT gives coincident edges (fine for filling, wrong for areas). section-box.ts boxCaps passes prism outlines: convex wall blocks.

## Depends on / used by
- uses: core/tolerance.ts, core/vector.ts
- used by: wall geometry (pieces, joins), app/section-box.ts (clipHalfPlane), others: to confirm by import map

## Problems found (finding IDs)
- none

## To check in other files
- callers that may pass a concave subject and then take its area

## Sources
- https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm : the clip region must be convex; a concave subject can give coincident edges (lines 48-68, 80-90)
