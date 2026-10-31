# tests/render/crisp.test.ts
Lines: 31
Summary: Tests of two plan-drawing helpers.
- crisp: a 1 px seam along a screen axis is moved onto pixel centres (x.5) so it draws at full strength. The tester measured a contrast of 2.95:1 for a seam drawn between two pixels, where the colours give 3.1:1. Vertical and near-vertical lines snap to x.5, horizontal lines snap to y.5, and slanted lines are left as they are.
- byLayers: whether walls are drawn by layer is one decision for the whole view, taken from the thinnest wall shown. 0.10 m walls at 50 px/m fall below the limit, at 60 px/m they are above it, and with no walls the answer is false. This came from the tester's H06, where different types switched at different zooms.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: why seams go on pixel centres (the measured contrast)
- 4-5 imports: vitest, byLayers and crisp from plan-view
- 7-11 x = 10 → 10.5; x 10.2/10.3 (nearly vertical) → 10.5
- 12-14 a horizontal line at y 7.9/8 moves to 7.5
- 15-18 a slanted segment unchanged; suite closes
- 20-26 the tester's H06; byLayers([0.2, 0.1]) false at 50 px/m, true at 60
- 27-30 an empty list → false; suite closes (line 31 blank)

## Contracts, state and data flow
- Pure helpers exported from render/plan-view.ts. A 1 px stroke centred on an integer coordinate covers half of two pixels; moving it to .5 fills one pixel.

## Depends on / used by
- uses: src/render/plan-view (crisp, byLayers)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Applying_styles_and_colors : strokes are centred on the path, so odd-width lines need a 0.5 offset to be crisp (lines 1-17)
