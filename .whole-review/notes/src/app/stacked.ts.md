# src/app/stacked.ts
Lines: 73
Summary: Pure check for walls standing on a wall of the level just below, parallel and overlapping, whose exterior faces do not line up (a step on the façade), with the shift that aligns them (Chief Architect's Align With Wall Below).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the step on the façade; the shift that aligns; pure
- 6-11 imports: COLLINEAR_ANGLE and POINT_TOLERANCE (core/tolerance), vector, wall offset helpers, shapeOf/WallShape, WallId, Doc
- 13-20 StackedStep: upper and lower wall ids, the step's size, the shift
- 22-26 PARALLEL = sin(COLLINEAR_ANGLE in radians), the engine's own in-line angle (F-0045 fixed); OVERLAP half the shorter wall and at least 20 cm
- 28-35 straight walls' shapes (arcs skipped, invalid or zero-length skipped)
- 36-38 each level's level below, by elevation; the steps list
- 39-49 per upper wall, the lower level's walls parallel to it (either direction: |cross| ≤ sin 0.6°)
- 50-54 the overlap along the lower wall; too little → skipped
- 55-62 the upper wall's faces across the lower wall's normal; skipped when the bands do not overlap (not standing on it)
- 63-69 the best overlapping lower wall: the step between the upper's lower face and the lower wall's right face (taken as exterior); a step under the tolerance → none for that pair, which still blocks a lesser overlap
- 70-72 the steps found

## Contracts, state and data flow
- "Exterior" is the lower wall's right side (smaller offset) by convention: a lower wall drawn the other way round has its exterior on the left, and the step is then measured on the interior face. Whether the app's walls keep that convention (drawn clockwise) is to check where walls are made.
- O(n²) over the walls of adjacent levels; called on demand.

## Depends on / used by
- uses: core/tolerance.ts, core/vector.ts, elements/wall/geometry (offset, shape)
- used by: app/frame.ts or panel warnings and the align action: to confirm when read

## Problems found (finding IDs)
- none confirmed (the exterior side assumption to check)

## To check in other files
- where stackedSteps is shown and how "align with wall below" applies the shift

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sin : radians; degrees × π/180 (line 23)
