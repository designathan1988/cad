# tests/elements/element-sizes.test.ts
Lines: 100
Summary: Tests that no element gets a zero or negative size: walls with a top below the base, a base above the top or a fixed height of 0 get MIN_ELEMENT_SIZE; stretching a wall's end onto its other end is refused and isWall refuses zero length; openings with width/height ≤ 0, a negative sill or NaN are refused by the store while 1.2 is accepted; elements scaled by 1e-4 stop at their minimums (column 0.05, beam 0.05, stair 0.4); floor types with a zero-thick layer or a zero-wide tile are invalid.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the rule that no element may get zero size
- 5-15 imports: vitest, document/wallHeights, createStore, MIN_ELEMENT_SIZE, vec, KINDS, opening commands and schema, addWalls, isOpening/isWall, stretchEnd
- 17-26 wall helper with optional top and base offsets for the height cases
- 28-52 walls: inverted top/base and a zero fixed height clamp to MIN_ELEMENT_SIZE; stretchEnd onto the other end refused; isWall refuses zero length
- 54-74 openings: width/height ≤ 0, sill < 0 and NaN refused through the store; 1.2 accepted; isOpening refuses a negative sill
- 76-88 scaling by 1e-4 through the kinds: column width/depth 0.05, beam width 0.05, stair width 0.4 (the minimums)
- 90-99 floor validity: a zero-thick layer or a zero-wide tile is invalid; the suite closes

## Contracts, state and data flow
- Pure: each case builds a doc or store and asserts; NaN refusal relies on comparisons with NaN being false (so validators must test it explicitly or use a positive-form check like `w > 0`).

## Depends on / used by
- uses: src/app/document, src/core/store, src/elements (MIN_ELEMENT_SIZE, KINDS registry), src/core/vec, src/elements/opening (commands, schema), src/elements/wall (commands, schema), src/tools/edit (stretchEnd)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/NaN : every relational comparison with NaN is false, so `NaN > 0` fails a positive-form check (line 63, width: Number.NaN refused)
