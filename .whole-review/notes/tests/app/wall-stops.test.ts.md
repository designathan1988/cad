# tests/app/wall-stops.test.ts
Lines: 47
Summary: Tests of wall stops (the stations along a wall's reference line where other walls' faces meet it): a T's two faces and a corner's inner face inside the wall only; a slanted partition's faces where they cross the line (±0.1·√2 at 45°); none for walls that do not reach it, run alongside, or stand on another level.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: other walls' face stations along the reference line
- 3-6 imports: vitest, document, wallStops, vec
- 8-19 wall helper with a level; doc builder
- 21-27 a T and a corner: [1.9, 2.1, 5.9]
- 29-35 a 45° partition: 3 ∓ 0.1·√2
- 37-45 none for far, alongside, other level
- 46 the suite closes

## Contracts, state and data flow
- Pure; these stops are what the opening tool and temporary dimensions measure from (F-0008, F-0042 context).

## Depends on / used by
- uses: src/app/document, src/app/wall-stops, src/core/vector
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/SQRT2 : √2 ≈ 1.4142135623730951 (lines 33-34)
