# tests/app/keyboard-select.test.ts
Lines: 31
Summary: Tests of stepping the selection through the level's elements in a fixed order: from nothing (first/last), from one (next/previous, wrapping), from several (after the last / before the first of them), and null with nothing to choose.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: says Tab/Shift+Tab (the keys are N/Shift+N now: F-0135 Also)
- 4-5 imports: vitest, stepSelection
- 7 the order: walls, an opening, a room
- 9-13 from nothing: first forward, last backward
- 15-20 from one, wrapping both ways
- 22-25 from several: after the last, before the first
- 27-30 nothing to choose: null

## Contracts, state and data flow
- Pure ordering function.

## Depends on / used by
- uses: src/app/keyboard-select
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0135 (Also): the header names the wrong keys

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobe : toBe and toBeNull for string ids and null (lines 11-28)
