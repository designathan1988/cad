# src/ui/overrides-dialog.ts
Lines: 110
Summary: The graphic overrides dialog: wall types filled with a colour of their own (a row per override with type, colour, remove; add the first free type in red), room uses filled with a colour (add the first free use, bathroom first, in blue), a note on renovation phases, and a button showing/hiding the overrides. One command per change.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: wall types and room uses filled with colours, shown or not; one command per change
- 5-12 imports: App, override commands and types, ROOM_USES, newId, controls, dialog, i18n, icons
- 14-18 showOverrides: the wall overrides and their setter
- 19-37 a row per wall override: type select, colour (committed on change), remove; labels and focus keys by index and id
- 38-45 add: the first type without an override (else the first type again: F-0128), red
- 46-67 room overrides: a row per use override with use select, colour, remove
- 68-75 add room override: the first free use, bathroom preferred, blue
- 76-82 shown/hidden toggle: toggles, closes and reopens the dialog
- 83-85 the Close button with its focus key
- 86-106 the dialog: walls, note (red = demolish), rooms, note, phases (red = to be built: F-0128), actions
- 107-109 opened; focus on Add

## Contracts, state and data flow
- Overrides live in the document (setOverrides, setRoomOverrides); whether they show is UI state (overridesOn).

## Depends on / used by
- uses: app/layer-sets, elements/room/schema, core/id, ui/controls, ui/dialog, ui/i18n, ui/icons
- used by: app (overrides action, browser's "Graphic overrides…")

## Problems found (finding IDs)
- F-0128 (S4): red means demolish and build; duplicate override for a type
- F-0116 (Also): notes say "on paper"

## To check in other files
- src/render/plan-view.ts: override precedence

## Sources
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color : input fires while picking, change when the picker is dismissed; value as lowercase #rrggbb (lines 28-31, 58-61)
