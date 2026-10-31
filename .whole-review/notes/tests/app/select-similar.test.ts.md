# tests/app/select-similar.test.ts
Lines: 56
Summary: Tests of "select similar": walls of the same type on the shown level; doors of the same kind and size; rooms of the same use (a room without use brings every room of the level); a mixed selection brings the like of each.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: from a selection, its like on the level shown
- 3-6 imports: vitest, document, similarTo, newOpening
- 8-15 wall helper with type, level and y
- 17-35 two levels, four walls, five openings (sizes and kinds), four rooms (uses)
- 37-55 the four cases (order: the selection first, then the others in document order)

## Contracts, state and data flow
- Pure; results ordered from the selection's Set (insertion order) then document order.

## Depends on / used by
- uses: src/app/document, src/app/select-similar, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set : Sets iterate in insertion order (the expected orders at 39-48)
