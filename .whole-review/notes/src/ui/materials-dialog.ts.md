# src/ui/materials-dialog.ts
Lines: 194
Summary: The materials dialog: the project's materials listed with colour chip and use count; the chosen one's name, colour, roughness, metalness, plan cut pattern, 3D surface pattern (kind, layout, piece sizes, joint, joint colour, second colour for checker, variation, angle), the removed simulations' physics section (F-0117), and a note; New, Duplicate, Delete (blocked when used or last), Copy link, Close. Each change is one command.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: materials list and the chosen one's properties; new/duplicate/delete; layers follow at once; laid out as the wall types dialog
- 6-18 imports: App, library link, libraryOf, newId, material commands, schema, pattern constants, physics, controls, dialog, textField, i18n, icons
- 20-27 showMaterials state and render setup: chosen kept valid; uses and their text
- 29-40 the list: a pressed button per material (chip, name, uses), choosing redraws
- 42-51 update (one command per change) and row (caption + control, focus key, aria-label)
- 52-67 detail: name (blank refused silently: F-0121 Also), colour (committed on change), roughness and metalness 0–1, cut pattern
- 68-104 surface pattern: kind (none or a kind's defaults), layout, length, width, joint, joint colour, second colour for checker, variation, angle
- 105-131 physics "for the simulations" (F-0117): own or table values with five fields and a note; back to the table; or a start set
- 132-143 the detail assembled (title, rows, pattern, physics, note mentioning the GLB: F-0116)
- 145-150 btn helper: a text button with a focus key and a handler
- 151-163 New (chosen before dispatch) and Duplicate ("(2)" each time: F-0122)
- 164-176 Delete: natively disabled with the reason in title/description (unreachable: F-0122)
- 177-179 Copy link of the chosen material
- 181-188 the dialog element: title, list and detail, the action row
- 190-193 opened (fallback focus on the chosen material)

## Contracts, state and data flow
- Through openProjectDialog; every control dispatches a material command; layers made of it follow in plan and 3D.

## Depends on / used by
- uses: app/library-link, io/library-file, core/id, elements/material (commands, schema, pattern, physics), ui/controls, ui/dialog, ui/fields (textField), ui/i18n, ui/icons
- used by: app (materials action, browser's "Materials…", wall type dialog links)

## Problems found (finding IDs)
- F-0117 (S3): physics section of the removed simulations
- F-0122 (S4): disabled delete hides its reason; duplicate names repeat
- F-0121 (Also): blank name leaves a blank field
- F-0116 (Also): mats.note mentions GLB

## To check in other files
- src/ui/types-dialog.ts, src/ui/objects-dialog.ts: delete buttons

## Sources
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/disabled : disabled controls get no mouse or focus events and cannot be focused (lines 164-176, F-0122)
