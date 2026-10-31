# src/elements/dimension/anchor.ts
Lines: 97
Summary: A dimension's ends (pure): what holds a point put on the plan (an opening's jamb, a wall from its nearer end, or a free point), where a held point is now, a dimension placed with its line and length, the offset through a point, and a point's distance to a segment.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: anchors read against the walls' chords; pure
- 5-8 imports: Doc, DerivedGeometry, vector, DimAnchor/Dimension
- 10-13 SAME 0.1 mm; SLACK 1 cm past a wall's body
- 15-18 axes: direction, normal, length of a segment
- 20-23 anchorAt: the level's walls; a wall's thickness from its derived layers
- 24-34 a jamb first: on a straight valid opening's wall, within the wall's FULL thickness either side of the reference line (+ slack), at a jamb's station (0.1 mm) → held by that jamb with its offset
- 35-46 else the wall whose body is nearest: outside distance along (past the ends by the thickness) and across (|offset| beyond the full thickness, again not the faces), within 1 cm
- 47-51 at a T, the wall whose END the point is nearest wins (tie broken by distance from an end)
- 52-56 an arc wall holds only near its ends; held from its nearer end with the distance along and the offset
- 57-58 nothing → a free point
- 60-76 resolve: a free point as it is; a wall's end + along + offset (gone → null); a jamb's station on the opening's wall + offset (gone → null)
- 78-85 placeDimension: both ends; zero length → null; the line offset to the left
- 87-88 offsetThrough: p's signed distance to the left of a→b
- 90-96 segmentDistance: to the clamped projection

## Contracts, state and data flow
- The wall "body" is taken as the full thickness either side of the reference line (31, 43-44), wider than the wall itself whatever its reference line: a point up to one thickness outside a face can still be held by that wall.
- An anchor on an opening resolves along the wall's chord: an opening on a wall later turned into an arc resolves off the arc.

## Depends on / used by
- uses: core/vector.ts, app/document.ts, app/geometry.ts (types), elements/dimension/schema.ts
- used by: app/kind-tools.ts (anchorAt, offsetThrough, placeDimension), app/select-drag.ts (dimension line), elements/kinds/dimension.ts, elements/dimension/constraints.ts, app/frame.ts

## Problems found (finding IDs)
- none (approximate body test noted)

## To check in other files
- elements/dimension/constraints.ts (settleDimensions: part of F-0008's follow-ups)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min : min of the arguments, NaN propagates, Infinity for none; used to clip a value (lines 49, 94)
