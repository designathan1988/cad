# tests/elements/curtain.test.ts
Lines: 49
Summary: Tests of curtain walls: grid lines by fixed spacing (remainder at the end; under 1 cm merged), fixed count, or largest spacing; the solid's mullions, transoms, panels and frame counts within the wall's length and height; commands refusing a grid dividing by nothing; file round trip and a bad grid dropped and reported.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: grid lines, frame and panels, read back
- 4-9 imports: vitest, newDocument, curtainSolid, Curtain/defaults/gridLines, updateCurtains, project file
- 11 a 4 m curtain with defaults
- 13-20 gridLines for spacing, count, max; a 5 mm remainder merged
- 22-36 the solid: 4 verticals, 3 horizontals, 6 panels, 13 frame pieces; all inside (comma-expression loop body)
- 38-47 count 0 refused; an update applied; round trip; an unknown mode dropped with its fix
- 48 the suite closes

## Contracts, state and data flow
- Pure; no test of very small spacings (F-0049's unbounded grid).

## Depends on / used by
- uses: src/app/document, src/elements/curtain (geometry, schema, commands), src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Comma_operator : both operands of a comma expression are evaluated each iteration (line 32)
