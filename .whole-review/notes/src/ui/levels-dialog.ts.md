# src/ui/levels-dialog.ts
Lines: 110
Summary: The levels dialog: one row per level (highest first) with its name, elevation, floor-to-floor height, plan cut height and a delete button that explains why it cannot delete (the last level, or one with walls); an overlap warning under a level that reaches into the one above; add level; close. Each change is one command.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: create, rename, elevation, height, cut height; one command each
- 4-12 imports: lengthText, App, cutHeightOf, newId, level commands, controls, dialog, i18n, icons
- 14-24 render: the grid's heads (cut height with its hint)
- 25-26 overlaps; levels sorted by elevation, descending
- 27-42 name input: committed on blur when changed (a blank name is refused by the command and the field stays blank: F-0121), Enter blurs, Esc restores (the dialog then closes)
- 43-66 delete: aria-disabled (not disabled, so its tooltip shows), named, the reason as title and aria-describedby; a click does nothing when blocked, else deletes and moves the shown level if needed
- 67-77 elevation, height (> 1 cm) and cut height (> 1 cm) number fields, each labelled with the level
- 78-85 the overlap warning (role status, warning icon)
- 86-93 add level: a new id and a default name, shown at once
- 94-104 close button and the dialog
- 105-109 opened; focus on Close

## Contracts, state and data flow
- Through openProjectDialog: redrawn from the store after each command. deleteBlocker checks walls only (other elements on a deleted level: F-0057).

## Depends on / used by
- uses: ui/units, app/document (cutHeightOf), core/id, elements/level/commands, ui/controls, ui/dialog, ui/i18n, ui/icons
- used by: app (levels action, browser's "Edit levels…")

## Problems found (finding IDs)
- F-0121 (S4): a blank name leaves the field blank

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled : only exposes the state; the element stays focusable and the script must block the action itself (lines 43-66: the click handler returns when blocked)
