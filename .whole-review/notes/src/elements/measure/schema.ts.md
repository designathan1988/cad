# src/elements/measure/schema.ts
Lines: 61
Summary: Measure elements: an angle (vertex, two arm points, arc radius), an arc wall's radius / diameter / length at one of its lines (held by the wall, leader at t along it), a point's coordinates (at, label); id and kind checks; the angle between two arms in degrees.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: angular, radius, arc and coordinate dimensions; kept with the project on a level
- 6 imports: Point2
- 8 MEASURE_PREFIX 'meas'
- 10-14 ArcMeasure and ARC_MEASURES; ArcFace and ARC_FACES
- 16-19 Base: id and level
- 21-28 AngleMeasure: vertex, a, b, arc radius
- 30-36 WallArcMeasure: type, wall, face, t (0..1)
- 38-43 CoordMeasure: at and label
- 45-49 Measure union; isMeasureId; isArcMeasure
- 51-60 angleBetween: 0 for a zero arm; the cosine clamped to [−1, 1] before acos (no NaN at the ends; small angles lose precision with acos, fine for display)

## Contracts, state and data flow
- Pure types and math.

## Depends on / used by
- uses: core/vector.ts (type)
- used by: elements/measure/commands.ts, place.ts, elements/kinds/measure.ts, app/kind-tools.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos : domain [−1, 1] else NaN; clamp the input (line 58)
