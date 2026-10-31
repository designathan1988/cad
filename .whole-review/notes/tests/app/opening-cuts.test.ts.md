# tests/app/opening-cuts.test.ts
Lines: 42
Summary: Tests that an opening wider than its wall is flagged openingOutside and cuts nothing (the walls' pieces and 3D blocks are exactly as without it), and that its temporary dimensions are never negative (one value, 1 m).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a misfit opening shows its warning and cuts nothing; no negative dimension
- 4-8 imports: vitest, document, deriveGeometry, tempDims, newOpening
- 10-19 wall helper: a concrete 20 centreline wall on the ground
- 21-24 two walls (an L) and a 5 m door on the 4 m wall
- 26-34 flagged; pieces and blocks equal to the plain plan
- 36-40 temporary dimensions all ≥ 0 and exactly [1] (so `every` is not vacuous)
- 41 the suite closes

## Contracts, state and data flow
- Pure derivation and temporary dimensions for a selection.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/app/temp-dims, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : every() is true for an empty array, which is why the next line checks the list itself (lines 38-39)
