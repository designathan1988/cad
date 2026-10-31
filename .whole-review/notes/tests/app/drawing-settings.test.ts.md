# tests/app/drawing-settings.test.ts
Lines: 43
Summary: Tests of the drawing scale and pens: pen factor 1 at 1:100, heavier at larger scales, monotone; detail level by scale; settings out of range refused by the guard and by setDrawing (unchanged and equal settings return the same doc); scale and pens round-trip through the file, and bad ones read as the defaults.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: pens heavier at a larger scale, detail per scale, kept in the file, one command
- 4-8 imports: vitest, drawingOf/newDocument, drawing schema, readProject/writeProject, setDrawing
- 10-16 scaleFactor: 1 at 100, >1 at 50, <1 at 200, non-increasing along SCALES
- 18-22 detailOf: fine ≤ 1:50, medium 1:75–1:100, coarse ≥ 1:200
- 24-33 isDrawingSettings refusals; setDrawing returns the same doc when invalid or equal, else the new scale
- 35-41 file round trip; a bad drawing reads as DEFAULT_DRAWING
- 42 the suite closes

## Contracts, state and data flow
- Pure; exercises ui/drawing-dialog's setDrawing and the file guard.

## Depends on / used by
- uses: src/app/document, src/elements/drawing/schema, src/io/project-file, src/ui/drawing-dialog
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobegreaterthan : strict greater/less than; equal values fail (lines 13-15)
