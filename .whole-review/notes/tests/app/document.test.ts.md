# tests/app/document.test.ts
Lines: 47
Summary: Tests of the document helpers: selectable element ids include openings, rooms and floors; walls are numbered per level in drawing order; the level shown at start is the last one shown if it exists, else the lowest level with content, else the lowest.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 imports: vitest, elementIds/newDocument/startLevel, newOpening
- 5-15 elementIds counts an opening, a room and a floor (the test's name also says walls; none are in its document)
- 17-24 wallNumber (dynamically imported) per level, null for an unknown id
- 26-34 two levels (upper listed first) and a room on the upper one
- 36-45 startLevel: the remembered one; else the lowest with content; an empty project's lowest
- 46 the suite closes

## Contracts, state and data flow
- Pure helpers of app/document.

## Depends on / used by
- uses: src/app/document, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import : import() resolves to the module namespace, the same instance for a module already loaded (line 19)
