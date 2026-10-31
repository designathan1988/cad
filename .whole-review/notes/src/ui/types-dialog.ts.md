# src/ui/types-dialog.ts
Lines: 208
Summary: The wall types store: the types as cards with a 3D wall sample (layers stepped at its end) and use counts, folders all/in the project, search, New (from the chosen type's layers); the chosen one's picture, thickness and layers, "draw a wall of it" (sets the next wall's type and the wall tool), Duplicate, Delete (blocked when used or the last, reason in title and description), its fields (top, base) and the layer editor. Every change one command; walls of the type follow.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: types as cards with a wall sample; folders; chosen one with picture, thickness, draw; name, top, base, layers; new, duplicate, delete
- 7-20 imports: App, newId, Material, wallTypeFields, type commands and blocker, layer types, controls, dialog, fields, i18n, icons, layerEditor, lengthText, wallSnapshot
- 22-32 pictures: WeakMap by materials array → layers array → size (invalidates on edits: F-0115 Also)
- 34-35 ALL and USED folder keys
- 37-45 showWallTypes state: chosen, query, folder, grid and side scroll, pending pictures, working
- 46-65 work: one pending picture per task (F-0126)
- 67-76 render setup: use counts, local fold (F-0126), found, in project, shown, chosen kept, thickness
- 78-99 search, icon and text button helpers
- 100-106 New: a new id chosen first, the chosen type's layers under a default name
- 107-115 head: title, search, count, New, close
- 117-128 folders: all and in the project
- 130-157 cards: kept scroll, picture or pending, use badge, name, thickness and layer count; click chooses (side scroll reset); empty message
- 159-166 update helper; side with its scroll kept across redraws
- 167-178 picture, name, thickness/layers, "draw a wall of it" (ui.defaults.wallTypeId and the wall tool: F-0030 Also), use count
- 179-184 Duplicate with a numbered copy name
- 185-198 Delete: natively disabled with title and aria-describedby (F-0122 Also); actions, type fields, layer editor
- 199-201 pictures started; the dialog element
- 203-207 opened; focus on the chosen card

## Contracts, state and data flow
- Through openProjectDialog; type commands dispatch; walls derive from their type, so they follow at once. The delete blocker ignores the next walls' type (F-0090).

## Depends on / used by
- uses: core/id, elements/material/schema (type), elements/wall (type-fields, types, schema), ui/controls, ui/dialog, ui/fields, ui/i18n, ui/icons, ui/layer-editor, ui/units, ui/wall-snapshot
- used by: app (wall types action, browser's "Edit wall types…", context "Edit this type…")

## Problems found (finding IDs)
- F-0122 (Also): disabled delete
- F-0030 (Also): the next wall's type written into ui.defaults
- F-0115 (Also): this cache invalidates correctly
- F-0126 (Also): store skeleton copy

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap : object keys compared by reference, entries collectable with their keys (lines 22-32)
