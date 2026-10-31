# tests/elements/column-shapes.test.ts
Lines: 34
Summary: Tests of column sections (counter-clockwise outlines with the right areas: rectangle, ellipse, I, H, L with 15 mm plates) and a column's top up to another level plus offset; setting topLevelId to null removes the field; a zero plate is refused.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: section by shape, top to another level
- 3-9 imports: vitest, newDocument, deriveGeometry, updateColumns, Column/columnOutline, ColumnSolid, signedArea
- 11 column helper (40×25 cm)
- 13-23 signed areas: 0.1; π·0.2·0.125 (2 digits for the polygonal ellipse); I, H, L by flange and web arithmetic
- 25-32 top to an upper level at 3 + 1 = 4; back to its own level drops the field; plate 0 refused
- 33 the suite closes

## Contracts, state and data flow
- Pure; positive signed area asserts counter-clockwise outlines.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/column (commands, schema), src/elements/kinds/column, src/elements/wall/geometry/convex
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Ellipse : the area of an ellipse is π·a·b (line 17)
