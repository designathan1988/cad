# tests/elements/guide-shapes.test.ts
Lines: 69
Summary: Tests of point and circle guides (phase 9): valid with their shape and a circle needing a positive radius, an unknown shape refused; picked near the point, or near the circle line but not inside; a copied circle's radius scaled by the transform; snapping puts the cursor onto a circle (onGuide), onto where it crosses a line guide or a wall segment (guideCross), and nothing of it from inside the circle.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: point and circle guides, picking, scaling and snapping
- 4-8 imports: vitest, vec, guideKind, the Guide type, snap and SnapInput
- 10-21 a point guide at (1,1), a circle of radius 2 at the origin, and the snap input helper (mpp 0.001, no segments)
- 23-30 validity: both shapes valid; radius 0 or missing and shape 'square' invalid
- 32-37 hit: within the point's tolerance, on the circle line, not inside the circle
- 39-44 mapped by a ×2 transform (cast as never): the copy's radius is 4; suite closes
- 46-53 snapping onto the circle from (1.41, 1.42): kind onGuide, distance 2 from the centre
- 55-63 crossing a horizontal line guide at (2,0) and a vertical wall segment at (0,2): kind guideCross
- 65-68 from inside the circle the snap is not onGuide; suite closes (line 69 blank)

## Contracts, state and data flow
- Pure: snap takes plain input with optional circles and guides; toBeCloseTo with 12 digits asserts exact projection onto the circle.
- The scale test casts a minimal transform `as never`, so the test does not check the transform's full type (only map is used).

## Depends on / used by
- uses: src/core/vector, src/elements/kinds/guide, src/elements/guide/schema, src/tools/snap
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html : toBeCloseTo's numDigits limits the decimal digits checked (lines 42, 52, 58-62 use 12)
