# tests/ui/ribbon-labels.test.ts
Lines: 32
Summary: Tests that every ribbon tab title, panel title and button short name has a message in both languages. On 2026-10-26 one missing label threw while the ribbon was drawn, and the whole ribbon came out empty. The ribbon is built from a stub app in a single state: the select tool, plan view, all levels in 3D, and nothing selected. Labels that only appear in other states (3D view, a selection, other tools) are not covered.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the empty-ribbon incident
- 4-7 imports: vitest, ribbonTabs, setLang/t, newDocument
- 9-14 a stub app cast `as never` (ui, store, shell) in one state
- 15-31 per language: every title and short name either translates or is counted missing (t returning the key, or throwing, caught with an optional catch binding); none missing; suite closes (line 31; 32 blank)

## Contracts, state and data flow
- ribbonTabs(app) builds the tabs from the app's state; t(key) returns the key itself when the message is missing. The ribbon renderer had no guard against a throwing label (the incident). The test guards only the labels reachable from this one state.

## Depends on / used by
- uses: src/app/ribbon-tabs, src/ui/i18n, src/app/document
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch : catch without a binding (line 23)
