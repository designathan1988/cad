# src/app/keymap.ts
Lines: 61
Summary: The user's remapped shortcuts: a map action id → key (or null for none), how keys are written and normalised, the key an event is, an action's current key, the action a key runs (by the actions' current keys, plus the second keys Ctrl+Y and Backspace), and assigning a key (taking it from any other action).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: WCAG 2.1.4; a remapped key runs its action; an action's own key does nothing once the action has another or none; keys written as the palette writes them
- 6 KeyMap type: Readonly<Record<action id, key | null>>
- 8-18 normalizeCombo: split on "+", modifiers recognised in any case (cmd/meta → Ctrl), the last non-modifier part as the key (one character upper-cased, a name capitalised), written Ctrl+Alt+Shift+key
- 20 NAMED: Delete → Del, Escape → Esc, " " → Space
- 22-31 comboOf(event): null for a modifier alone (Control, Shift, Alt, Meta, CapsLock; AltGraph is not in the list, so AltGr alone becomes a "key"); letters/digits upper-cased; named keys kept; Shift counted only with a letter, digit or named key (a typed symbol like ? is itself); Ctrl or Meta → Ctrl
- 33-37 keyOf: the map's value when the id is in it (null → no key), else the action's own
- 39-40 SECOND_KEYS: edit.redo also Ctrl+Y, edit.delete also Backspace (the help shows them; F-0021)
- 42-52 actionOfKey(combo, actions): the action whose current `keys` (already keyOf'd by the action list) is this combo, sequences ("W, Q") excluded; else the action whose second key it is while its keys are still its own (remapped or turned off: the second key goes with it). An own key moved elsewhere matches nothing (F-0021: replaces resolveKey)
- 54-60 assignKey: the id given the combo; every other ACTION whose current key is that combo loses it (null), returned as taken

## Contracts, state and data flow
- Only actions are considered: keys that tools handle on their own in input-keys.ts (A, Q, C, U, H, Space within tools; arrows; digits; Esc steps) are invisible here, so assigning such a key to an action can be shadowed by the tool inside that tool (input-keys now runs the tools' own keys before actionOfKey for plain keys): F-0027.
- Sequences ("W, Q") cannot be remapped.

## Depends on / used by
- uses: nothing
- used by: app/actions.ts (keyOf), app/input-keys.ts (comboOf, actionOfKey), app/input.ts (SECOND_KEYS, help), ui/keys-dialog.ts (assignKey, comboOf, keyOf), app/app.ts (KeyMap), tests/app/keymap.test.ts

## Problems found (finding IDs)
- F-0027 a key the tools use on their own can be given to an action without a warning
- F-0021 fixed: keys run through actionOfKey over the action list's current keys

## To check in other files
- ui/keys-dialog.ts: how a key is captured and conflicts shown

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values : "Delete", "Escape", " " (Space), "Control", "Shift", "Alt", "Meta", "CapsLock"; AltGr is "AltGraph" (lines 20, 24)
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key : key carries the modifiers (Shift+B → "B"), control keys are named ("Delete", "Backspace", "Home", "Escape") (comboOf and the SECOND_KEYS combos)
