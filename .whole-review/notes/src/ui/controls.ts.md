# src/ui/controls.ts
Lines: 341
Summary: The shared form controls of every panel and dialog: el() element builder, collapsible sections remembered by title, label+control rows, the number field (lengths in the project's unit, expressions, min/max with an announced error, Enter/blur commits, Esc restores), label scrubbing, segmented buttons, native selects, and a searchable select with thumbnails (an APG-style combobox in a popup).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: one place for all panel controls; they only read values and report changes
- 4-8 imports: unit formatting, length/number parsing, icons, i18n, search
- 10-22 el: createElement with attributes (class as className) and children
- 24-28 sectionOpen: open/closed state per section title, kept across rebuilds
- 30-39 section: a <details> with a chevron summary, its open state remembered; rows unwrapped into the grid
- 41-63 row: label (text or icon + text, title for the cut name, own-value dot, wide layout) bound by `for` to the first input/select/button of the control (random id unless given)
- 65-82 numberField setup: text input with decimal keyboard; `current` value; lengths shown in the project unit; "various" placeholder when null
- 83-99 error span (role alert) and refuse/clear (aria-invalid, aria-describedby)
- 100-127 commit: empty or unchanged restores; parse (length or number); below min / above max refused with a message; else applied and shown in the house format
- 128-139 keys: Enter commits and blurs, Esc restores and blurs (stopPropagation keeps the app's shortcuts out); blur commits; typing clears the error
- 140-143 the unit after the value (none for feet-inches)
- 145-169 scrub: horizontal drag on the label, 1 cm per pixel, rounded, min applied, shown live in the field, one commit on pointerup (no pointercancel/lostpointercapture: F-0109)
- 171-193 segmented: role group of aria-pressed buttons with icon and/or label; a pointer click gives the focus back to the drawing
- 195-224 select: native select with a disabled "various" option when null, hover title, blur after a pointer choice, keydown not propagated, chevron icon
- 226-251 searchSelect button: aria-haspopup dialog, aria-expanded, label with the current option, data-focus-key to refocus after a rebuild
- 252-288 openList: popup dialog with a combobox input and a listbox; setActive (aria-selected, aria-activedescendant, scroll into view); pick closes, changes, refocuses the rebuilt button
- 289-315 update (search filtered options, thumbnails, current marked) and keys (arrows wrap, Enter picks, Esc/Tab close)
- 316-324 outside pointerdown closes; close removes the listener, the popup, resets aria-expanded and refocuses the button
- 325-337 placement: width ≥ 180, kept inside the window, below or above the button (above measured before the list is filled: F-0108); outside listener; update and focus
- 339-340 the wrapper returned

## Contracts, state and data flow
- Controls hold no model state: callbacks report changes; panels are rebuilt after each change, so focus is restored by data-focus-key and section state by title (shared by every section of the same title).

## Depends on / used by
- uses: ui/units, core/measure, ui/icons, ui/i18n, ui/search
- used by: every panel and dialog (ui/fields.ts, ui/shell.ts, ui/browser.ts, ui/*-dialog.ts, elements/*/panel.ts)

## Problems found (finding IDs)
- F-0108 (S4): the upward popup is placed by its empty height
- F-0109 (S4): scrub ignores pointercancel

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event : pointercancel when the browser takes the pointer (pan, zoom, palm rejection); drag ends should also listen for it and lostpointercapture (lines 145-169, F-0109)
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetHeight : the height with padding and borders as laid out when read (lines 325-336, F-0108)
