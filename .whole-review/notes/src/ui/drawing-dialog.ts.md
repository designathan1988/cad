# src/ui/drawing-dialog.ts
Lines: 57
Summary: The project's drawing settings dialog (moved from the removed print dialog): the plan scale, the pen widths per role in millimetres, and the room tag style, each change one setDrawing command; the setDrawing command itself (validated, no-op when equal).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the project's scale and pens, one command per change
- 4-10 imports: App, Doc/drawingOf, Command, drawing schema (settings, validation, pen limits and roles, room tags, scales), controls, openProjectDialog, i18n
- 12-15 setDrawing: invalid or unchanged (JSON compare) leaves the doc; else sets drawing
- 17-22 row: caption + control, the inner input/select given its focus key and aria-label
- 24-29 showDrawingSettings: a project dialog; the current settings and the change dispatcher
- 30-37 scale select: shows the scale in force (a saved view's when shown), and on change clears the view's scale and sets the project's (unlike the view bar: F-0019)
- 38-42 room tag style select
- 43 pen rows: one millimetre field per role between PEN_MIN and PEN_MAX
- 44-46 the Close button (focus key "close")
- 47-53 the dialog: title, scale, pens, room tag, a note, actions
- 54-56 opened; focus on the scale

## Contracts, state and data flow
- Each control dispatches a whole new DrawingSettings; the dialog frame redraws from the store.

## Depends on / used by
- uses: app/document (drawingOf), core/store (Command), elements/drawing/schema, ui/controls, ui/dialog, ui/i18n
- used by: app (the drawing settings action in the ribbon/actions: showDrawingSettings; setDrawing also by input-buttons.ts for the view bar's scale list)

## Problems found (finding IDs)
- none new; F-0019's proof cites this file as the correct handling (viewDen cleared before the change)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event : a select fires change when the user commits a choice; text inputs on losing focus after a change (lines 30-42)
