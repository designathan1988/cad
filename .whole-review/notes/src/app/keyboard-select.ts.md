# src/app/keyboard-select.ts
Lines: 11
Summary: Pure step through an ordered list of element ids from the current selection, forward or back, wrapping round; used by N / Shift+N.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: "the element Tab (or Shift+Tab) goes to" — but the keys are N / Shift+N (input-keys.ts:271, 323); Tab cycles snaps (F-0026)
- 4-10 stepSelection(order, selected, dir): empty order → null; none of the selection in the order → the first (forward) or last (back); else from the last selected (forward) or the first (back), one step with wrap-around

## Contracts, state and data flow
- Pure; indexOf -1 for ids not in the order are dropped.

## Depends on / used by
- uses: nothing
- used by: app/selection-ui.ts (stepSelectionHere), tests/app/keyboard-select.test.ts

## Problems found (finding IDs)
- F-0026 the header names Tab for what N does

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf : -1 when absent, strict equality (line 6)
