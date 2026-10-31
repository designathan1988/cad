# src/core/tolerance.ts
Lines: 17
Summary: The geometric tolerances (meant as their single source): wall ends meeting (1 mm), in-line angle (0.6°), miter limit (10×), minimum wall length (1 mm), minimum element size (1 cm), smallest area kept (1e-9 m²), arc sag (0.5 mm).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: single source of every geometric tolerance; changing one needs an ADR
- 3-4 POINT_TOLERANCE 1 mm: wall ends closer meet
- 5-6 COLLINEAR_ANGLE 0.6°: in line
- 7-8 MITER_LIMIT 10: a longer miter is cut square
- 9-10 MIN_WALL_LENGTH 1 mm
- 11-12 MIN_ELEMENT_SIZE 1 cm: no element size 0 or less
- 13-14 AREA_EPSILON 1e-9 m²: smaller pieces dropped
- 15-16 ARC_SAG 0.5 mm: chord gap of arc faces (ADR 0001)

## Contracts, state and data flow
- stacked.ts:23 now reads COLLINEAR_ANGLE (F-0045 fixed); wall-stops.ts (MIN_SINE 0.1, TOUCH 1 cm), convex.ts (ON_LINE 1e-11), section-drawing.ts (1e-9, 1e-7, 0.1 mm keys) keep their own (F-0045).

## Depends on / used by
- uses: nothing
- used by: wall geometry, tools, app files (MIN_WALL_LENGTH, POINT_TOLERANCE, AREA_EPSILON…)

## Problems found (finding IDs)
- F-0045 fixed: stacked.ts reads COLLINEAR_ANGLE (the other files' values listed above are their own, not copies of these)

## To check in other files
- other literal tolerances that should be these

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/EPSILON : compare floats with a tolerance chosen for the magnitude and input accuracy, not ===  (lines 3-16)
