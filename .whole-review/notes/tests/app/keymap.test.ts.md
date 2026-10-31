# tests/app/keymap.test.ts
Lines: 79
Summary: Tests of the shortcut map: combos written one way (modifier order, capitals, Cmd as Ctrl), events turned into combos (Shift with letters, symbols as typed, Del, Esc, F-keys, a lone modifier none); an action's key (the user's, none, its own); the action a key runs over the actions' current keys (the user's runs, the replaced own key runs nothing, turned off nothing, sequences never one key); a second key (Ctrl+Y) while redo keeps its own, gone once remapped or off; assigning a key takes it from its holder.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: remapped and turned-off shortcuts (WCAG 2.1.4)
- 5-6 imports: vitest, keymap functions and KeyMap
- 8-23 an event stub, sample actions (a fictional file.print, edit.redo) and keyed(map): the actions with keys = keyOf, as the action list builds them
- 25-42 normalizeCombo and comboOf cases
- 44-50 keyOf: default, remapped, turned off, a key for an action without one
- 52-61 actionOfKey: the user's key runs, the moved own key runs nothing, another action's own key runs it; turned off nothing; the "W, A" sequence never matches W
- 63-68 second keys: Ctrl+Y and Ctrl+Shift+Z redo; Ctrl+Y nothing once redo is remapped or off
- 70-77 assignKey: taken from the holder (set to null), the new holder runs; nothing taken when free
- 78 the suite closes

## Contracts, state and data flow
- Pure keymap logic; the tools' own keys outside the action list are not covered (F-0027).

## Depends on / used by
- uses: src/app/keymap
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none (F-0021: resolveKey replaced by actionOfKey, its cases kept)

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html : single printable-key shortcuts must be able to be turned off, remapped or be active only on focus (the turned-off and remapped cases, lines 44-77)
