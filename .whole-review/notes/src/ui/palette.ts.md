# src/ui/palette.ts
Lines: 101
Summary: The command palette (Ctrl+K): a modal dialog with a combobox input and a listbox of every action found by name (enabled ones first), each option showing its group (or "not available now") and its key; arrows move the active option (aria-activedescendant), Enter runs it, Esc or a click outside closes and gives focus back, Tab stays. One open at a time.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: APG combobox with listbox; focus stays in the field; option shows where and its key
- 6-9 imports: Action type, el, t, searchEntries
- 11 close: the open palette's closer
- 13-15 showPalette: closes another, remembers the focus
- 16-32 overlay, combobox input (expanded, controls the list, autocomplete list), listbox, live status, dialog
- 34-44 active option: aria-selected on each, aria-activedescendant, scrolled into view
- 45-49 run: only enabled actions; closes without restoring focus, then runs
- 50-71 update: search, enabled first; options with label, group (or disabled note), key, aria-disabled; hover activates; click runs; status count; first active
- 73-85 input events: update on input; keys (down/up wrap, Enter runs, Escape closes, Tab kept), propagation stopped
- 86-88 pointerdown on the overlay closes
- 90-96 finish: removes, focus back when nothing ran; close set
- 97-100 shown, filled, focused

## Contracts, state and data flow
- The action list is taken when it opens (keys shown are the current keymap's through Action.keys).

## Depends on / used by
- uses: app/actions (Action type), ui/controls, ui/i18n, ui/search
- used by: app (Ctrl+K, top bar search button)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ : combobox attributes (aria-expanded, aria-controls, aria-autocomplete, aria-activedescendant), Down/Up/Enter/Escape, DOM focus stays on the combobox for a listbox popup (lines 16-85)
