# src/ui/sections-dialog.ts
Lines: 89
Summary: The sections and elevations dialog: the marks listed (section, elevation, or a room's interior elevation with its level), the chosen one drawn from the model as it is now into a 640×360 canvas fitted to its extent with room for the level marks, plus "make the four elevations" and "draw a section in plan" (closes and starts the tool).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: marks listed, the chosen drawn "as it prints", four elevations, section tool, interior elevations
- 6-12 imports: App, Doc/levelOf, SectionMark, sectionOf/sectionCanvas, el, dialog, i18n
- 14-16 preview size 640×360 px
- 18-24 markKind: section, elevation, or interior elevation with its level's name
- 26-33 showSections: current mark kept valid
- 34-46 the list: role list of buttons given role listitem with aria-pressed (F-0130)
- 47-55 make elevations; draw a section (closes, section tool)
- 56-73 the preview: empty note, or the drawing fitted (scale from the box and 75% width, the level marks' margin), drawn by sectionCanvas at up to 2× pixel ratio, role img with its name, and a note
- 74-83 Close and the dialog (classes from the removed sheets: F-0130)
- 84-88 the focus fallback and the first focus

## Contracts, state and data flow
- Through openProjectDialog; the preview is redrawn on every redraw from sectionOf's caches (F-0038).

## Depends on / used by
- uses: app/document, elements/section/schema, app/section-view, ui/controls, ui/dialog, ui/i18n
- used by: app (sections action, browser's "Sections and elevations…", section panel's button)

## Problems found (finding IDs)
- F-0130 (S4): role listitem on buttons; leftover sheet/print/tour class names
- F-0038 (Also): the caller passes nothing about hidden categories

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/listitem_role : an ARIA role replaces native semantics; listitem belongs inside a list and is not allowed on a button (lines 34-46, F-0130)
