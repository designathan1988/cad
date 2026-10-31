# src/core/measure.ts
Lines: 163
Summary: The typed-measure parser (never eval): lengths with units (mm, cm, m, ft/', in/", feet-and-inches), plain numbers, "x;y" and "@dx;dy" points, "length<angle"; + - * / x × and parentheses; numbers with comma or point; a bare number in the project's length unit; the project's named lengths (variables).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: examples; "+ − × ÷ and parentheses" (÷ and the true minus sign − are NOT parsed: only "-", "/", "*", "x", "×"; F-0044)
- 6 Parsed<T>: ok with a value, or not
- 8 UNITS: metres per mm, cm, m, ft, ', in, "
- 10-14 bare: metres per unit of a bare number (module state set by the app)
- 16-20 variables: the project's named lengths (module state set by the app)
- 22-23 isVariableName: a letter (A-Z, a-z, À-ÿ — a range that includes × U+00D7 and ÷ U+00F7) or _, then letters/digits/_; not a unit name or x
- 25-31 parseLength: "=" prefix dropped; an expression read to the end; finite
- 33-38 parseNumber: without units
- 40-50 parsePointFrom: "@dx;dy" from a point (none → not one), else parsePoint
- 52-59 parsePoint: two lengths split by ";"
- 61-73 parseLengthAngle: "length<angle" (angle a plain expression), or a length alone
- 75-85 Parser state; done(): only spaces left
- 87-98 expression: terms joined by + and -
- 100-112 term: factors joined by *, /, x, × (the right one without a unit)
- 114-127 factor: unary minus, parentheses
- 128-133 a variable by name: the regex takes letters including × and ÷ (so "pd×2" reads as one unknown name and fails, while "pd*2" works: F-0044); `in variables` also sees Object.prototype names ("toString"), which then fail as non-finite
- 134-138 a number (comma or point); plain → itself
- 139-152 a unit (or the bare unit); feet followed by inches
- 154-162 peek and skip (spaces only, not tabs)

## Contracts, state and data flow
- Two module-level states (bare unit, variables) set by the app: every caller sees the latest (the same pattern as core/collisions.ts).

## Depends on / used by
- uses: nothing
- used by: app/wall-ui.ts, ui/units.ts, ui/fields.ts (typed fields), tools, app/guide-ui.ts, tests/core/measure.test.ts

## Problems found (finding IDs)
- F-0044 "×" right after a variable name is read as part of the name; "÷" and "−" promised but not parsed

## To check in other files
- ui/units.ts typingExamples: which operators the hint promises

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in : `in` checks the prototype chain ('toString' in {} is true); Object.hasOwn checks own keys (line 130)
- https://en.wikipedia.org/wiki/Latin-1_Supplement : × U+00D7 and ÷ U+00F7 lie between À U+00C0 and ÿ U+00FF (lines 23, 129)
