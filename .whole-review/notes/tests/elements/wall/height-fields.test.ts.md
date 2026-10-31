# tests/elements/wall/height-fields.test.ts
Lines: 30
Summary: Tests of a wall's height in the panel. A wall that goes up to the level's ceiling shows its actual height as a readout ("heightNow"): the level's height plus the top offset. This came from a 2026-10-25 test run in which the user had to work the height out from "Pé-direito" and an offset. A wall with a fixed height shows its height field and no readout.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: why the readout exists (the 2026-10-25 run)
- 4-7 imports: vitest, DocWall/newDocument, wallFields, fieldStates
- 9-10 a 4 m wall on the ground level and a stub actions object (the same ten callbacks as in arc-fields.test.ts)
- 12-20 top to the level with offset −0.3: the constraints section has a readout heightNow whose text is (level height − 0.3).toFixed(2) + " m" (English default; the code uses lengthText)
- 22-29 a fixed top of 1.1: topHeight present, heightNow absent; suite closes (line 30 blank)

## Contracts, state and data flow
- The readout's text comes from wallHeights and lengthText (fields.ts:200-205), so it follows the project's units and language. The test's expected string uses toFixed, which always writes a point; it matches only while the test runs in English.

## Depends on / used by
- uses: src/app/document, src/elements/wall/fields, src/ui/fields
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed : returns a fixed-point string with a point, not locale-aware (line 19)
