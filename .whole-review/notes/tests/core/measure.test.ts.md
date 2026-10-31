# tests/core/measure.test.ts
Lines: 64
Summary: Tests of the typed-measure parser: lengths with comma or point decimals, units (cm, mm, m), arithmetic and parentheses, a leading decimal; rejections (empty, letters, two commas, dangling operator, unclosed parenthesis, unknown unit, code-like text, Infinity); "length<angle" and a length alone, rejecting two angles or a unit on the angle; "x;y" points with units and expressions, and non-points refused.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 imports: vitest, parseLength/parseLengthAngle/parsePoint
- 4-7 len: the parsed metres or null
- 9-32 lengths: fourteen accepted texts (it.each with %s and %d in names) and eight rejected (%j)
- 34-45 length and angle
- 47-63 points: accepted and refused forms

## Contracts, state and data flow
- Pure parser cases (with the default bare unit, metres).

## Depends on / used by
- uses: src/core/measure
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/#test-each : test.each name placeholders (%s string, %d number, %j json) (lines 10-29)
