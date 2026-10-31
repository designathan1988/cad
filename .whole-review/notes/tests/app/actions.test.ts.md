# tests/app/actions.test.ts
Lines: 76
Summary: Vitest tests of the command palette's action list: Portuguese search finds "new project"; ids unique and covering tools, views, edit, file, settings, layers, levels and help; the default keys shown; enabled states; labels in both languages found by either.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: every action named in both languages, enabled only when it can run
- 4-11 imports: vitest, appActions, App type, newDocument, createStore, addLevel, setLang, VIEW_3D_DEFAULT
- 13-18 fakeApp (store with an upper level, ui stub, canMergeSelection, selectedDoor, arrangeItems) and the dialog openers stub
- 20-27 Portuguese "nov" finds file.new
- 29-41 unique ids and the expected ids present
- 43-54 the default keys of the main actions (V, W, L, D, Shift+W, R, 1, 2, F, Home, Ctrl+Z, …), and the context menu's two (edit.flipHinge H, help.commands Ctrl+K)
- 56-61 enabled states with nothing selected vs a selection in 3D
- 63-75 non-empty Portuguese labels whose keywords contain the English label's first word; two exact labels

## Contracts, state and data flow
- Reads the action list only; no action runs. The expected keys are the defaults (no keymap).

## Depends on / used by
- uses: src/app/actions.ts, document, store, level commands, i18n, view-3d
- used by: the test runner (not run in this review)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html : toMatchObject checks a subset of properties; toContain checks array membership or a substring (lines 25-72)
