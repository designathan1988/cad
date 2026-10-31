# src/ui/openings-dialog.ts
Lines: 152
Summary: The doors and windows store: the built-in opening models as searchable cards (folders all/doors/windows) with lazily made 3D pictures in a piece of wall, the chosen one's large picture, size, sill, operation, leaves, transom, threshold and frame, and Place: the door or window tool with its next opening set to that model and size.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: models as cards in 3D, folders, chosen one with size and operation, placing as main action
- 6-14 imports: App, OpeningKind, OPENING_MODELS, el, dialog, i18n, icons, openingSnapshot, lengthText
- 16-22 pictures: a session Map by model id and size (models are built in, so stable)
- 24 nameOf: the model's translated name
- 26-32 showOpenings state: folder, chosen (first of the kind asked), query, scroll, pending, working
- 33-53 work: one pending picture per task while the store is open (a copy of the other stores': F-0126)
- 54-59 render setup: local fold (F-0126), found by name and kind word, shown by folder, chosen kept
- 61-74 head: search (resets folder and scroll), close, count
- 76-91 folders: all, doors, windows with counts
- 93-99 grid with kept scroll
- 100-105 place: closes, writes ui.openingDefaults[kind] (style and size) directly (F-0030 Also), starts the tool
- 106-125 cards: picture or pending, name, kind and size; click chooses, double click places; empty message
- 127-145 side: picture, name, kind and operation, width/height/sill, facts (leaves, transom, threshold, frame), Place and its note
- 146-148 pictures started; the dialog element
- 149-151 opened; the chosen card focused

## Contracts, state and data flow
- No store commands: placing sets UI defaults and the tool; the dialog redraws through openProjectDialog only on its own state changes.

## Depends on / used by
- uses: elements/opening (schema, style), ui/controls, ui/dialog, ui/i18n, ui/icons, ui/opening-snapshot, ui/units
- used by: app (doors and windows store action, ribbon)

## Problems found (finding IDs)
- F-0126 (S4): the stores' duplicated skeleton and folds
- F-0030 (Also): next opening written into ui.openingDefaults, not the next-element template
- F-0127 (S4): double click to place after a redraw

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Element/dblclick_event : dblclick fires after two clicks on a single element (lines 118-122: the first click rebuilds the card, F-0127)
