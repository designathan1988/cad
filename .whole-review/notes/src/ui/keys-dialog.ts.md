# src/ui/keys-dialog.ts
Lines: 105
Summary: The keyboard shortcuts dialog: every palette action (but levels, objects and snap parts) with its current key, searchable; a click on the key captures the next combo as its new key (taking it from any action that had it, said in a status line), Off clears it, Default restores it, Reset all clears every change. Kept in the preferences.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: every action with its key; press to set, off, default; a key taken from another is said; kept with the preferences
- 5-9 imports: App, keymap helpers (assignKey, comboOf, keyOf), el, openProjectDialog, t
- 11-14 showKeys state: filter, capturing action id, status text
- 15-35 listen (window, capture, added on click): the combo; Esc gives up; else assignKey over the action list, the keymap saved, the status says what was set or taken; redraw (runs after the dialog's own key handler: F-0120)
- 36-46 render: actions without level/object/snap-part ones; search box; filter on label, keywords and keys; the list
- 47-78 per action: its default and current key; the key button (captures on click, "Press a key…" while capturing); Off (disabled with no key); Default (disabled when unchanged); the row marked when changed
- 79-86 Reset all (disabled when nothing changed)
- 87-93 Close: ends any capture, closes
- 94-101 the dialog: title, search and status, list, actions
- 102-104 opened; focus on the search

## Contracts, state and data flow
- The keymap lives in the app (setKeymap persists it); the dialog redraws from it. Tool-local keys are not actions, so they are not protected (F-0027).

## Depends on / used by
- uses: app/keymap, ui/controls, ui/dialog, ui/i18n
- used by: app (the shortcuts action: showKeys)

## Problems found (finding IDs)
- F-0120 (S3): capture conflicts with the dialog's Esc and undo; a capture left open after a backdrop close eats the next key
- F-0027 (Also): tools' own keys taken without a warning

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation : listeners on one element run in the order added; stopPropagation lets the others on that element run, stopImmediatePropagation does not (lines 15-35, 57; F-0120)
