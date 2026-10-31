# tests/core/measure-more.test.ts
Lines: 67
Summary: Tests of typed measures from phase 9: "@dx;dy" relative to the point drawn from (and none without one), project variables by name in expressions (also after "="), variables always in metres whatever the bare unit, valid variable names, and variables kept in the file (bad ones dropped) with setProjectVariables refusing bad names and removing the field when empty.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: relative points and named variables
- 4-8 imports: vitest, measure functions, newDocument, project file, setProjectVariables
- 10-13 afterEach: variables cleared, bare unit back to metres (module state)
- 15-26 relative points: from a point, absolute, spaces and units; none without a point or with one coordinate
- 28-40 variables in expressions, "=" prefix, an unknown name refused
- 42-46 variables stay in metres with a centimetre bare unit
- 48-55 isVariableName cases
- 57-66 file round trip (and the suite's end); bad name refused; empty removes; bad entries dropped on reading

## Contracts, state and data flow
- core/measure keeps module state (variables, bare unit), so each test resets it.

## Depends on / used by
- uses: src/core/measure, src/app/document, src/io/project-file, src/ui/variables-dialog
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none (F-0134's inherited names are not covered here)

## To check in other files
- none

## Sources
- https://vitest.dev/api/hooks.html : a top-level afterEach runs after every test in the file (lines 10-13)
