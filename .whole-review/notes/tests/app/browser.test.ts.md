# tests/app/browser.test.ts
Lines: 56
Summary: Tests of the project browser's data: hiding categories leaves the other derived maps by identity (and an empty set returns the same geometry); wall type usage counts every type, and per level.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: hideable categories and wall type usage
- 3-8 imports: floorsOf, vitest, document, deriveGeometry/hideCategories, typeUsage, newOpening
- 10-19 wall helper with a type
- 21-27 a box of two concrete and two masonry walls, a door, a room and its floor
- 29-39 hiding rooms empties rooms and keeps walls/floors by reference; hiding all four empties them; no hidden → the same geometry
- 41-47 usage per type, zero for unused, every type listed
- 49-55 usage per level (ground, upper, all); the suite closes

## Contracts, state and data flow
- Pure derivations; identity (toBe) asserts that hiding does not rebuild the other categories.

## Depends on / used by
- uses: src/elements/registry, src/app/document, src/app/geometry, src/app/browser-data, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobe : toBe compares with Object.is (same reference for objects) (lines 34-38)
