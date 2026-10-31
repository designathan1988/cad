# tests/app/view-keys.test.ts
Lines: 28
Summary: Tests of the view keys: + or = zoom in, − zoom out; Shift+arrows pan 80 px; Shift with + still zooms; plain arrows (the selection's nudge), Ctrl/Alt combinations, and − while a measure is typed are not view keys.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the tester's K4; + and − zoom, Shift+arrows move or turn; plain arrows nudge; − is a sign when typing
- 4-5 imports: vitest, viewKey
- 7-8 k: viewKey with default modifiers
- 10-15 zoom keys: + and = in, − out
- 16-20 pan with Shift+arrows; Shift with + zooms
- 21-27 refused cases (plain arrows, Alt, Ctrl, typing −)

## Contracts, state and data flow
- Pure key mapping (these keys are not in the action list, so they cannot be remapped: F-0027's family).

## Depends on / used by
- uses: src/app/view-keys
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key : printable keys report their character with Shift applied (Shift+= gives "+", minus gives "-") (lines 11-19)
