# src/ui/objects-dialog.ts
Lines: 366
Summary: The objects store: the project's parametric definitions as a searchable card grid with folders (all, in the project, each folder with counts), 3D pictures made lazily one per task, the chosen one's large picture, size, types and Place as the main action, plus Edit (definition editor), Duplicate, Copy link and Delete (blocked when placed or nested); a library menu with New, Import file and Export file. Also the blank definition, folder and search helpers, the plan thumbnail SVG, and the library import.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: definitions with counts; place, new, duplicate, edit, delete; library files
- 6-21 imports: App/Doc, library link, newId, definition commands, evaluate helpers, words, schema, library file, controls, dialog, editor, i18n, icons, objectSnapshot, lengthText
- 23-39 blankDefinition: one box with width/depth/height parameters and a material, handles on them, one type
- 41-42 folderOf: its folder or its category's name
- 44-51 fold and answers: accent/case-insensitive search by either name or folder
- 53-68 thumbnailSvg: pieces' plan outlines at the first type, highest last, filled with their colours, in a padded square viewBox (spread min/max)
- 70-80 pictureOf: WeakMap by materials array → definition → type@size (correct invalidation)
- 82-92 sizeOf: width, depth, height from the pieces' outlines and spans
- 94-96 ALL and PLACED folder keys
- 98-118 showObjects state: chosen, query, folder, menu open, grid scroll, type per definition; hidden file input importing a library
- 119-143 work: one pending picture per task while the store is open
- 144-158 render setup: placed counts, name sort in the language, search, folder counts, shown list, chosen kept, its type
- 159-176 head: search (resets the folder), icon button helper
- 177-209 the library "more" menu: a toggled div with role menu (no menu keyboard: F-0125); New opens the editor, Import clicks the file input, Export downloads the library
- 210-219 head assembled (title, search, count, menu, close, file input)
- 221-234 folders nav with counts
- 236-267 cards: scroll kept; picture or pending; badge with placed count; name and folder/types; click chooses, double click places; empty message
- 269-292 side: large picture, name, folder, size, types as a radiogroup
- 293-299 Place (closes and starts placing at the chosen type)
- 300-328 Edit (editor in its place, returns here), Duplicate ("(2)": F-0122 Also), Copy link, Delete (natively disabled with the reason in title: F-0122 Also), placed count, summary
- 329-336 pictures started; the dialog element
- 337-342 opened; the chosen card focused and centred; scroll remembered
- 344-365 importLibrary: parse (error message on failure), merge checked, one undo step re-merging inside the command, a summary toast

## Contracts, state and data flow
- Through openProjectDialog; actions dispatch definition commands; Place and Edit close the store first.

## Depends on / used by
- uses: app/library-link, core/id, elements/object (commands, evaluate, fields, schema), io/library-file, ui/controls, ui/dialog, ui/definition-editor, ui/i18n, ui/icons, ui/object-snapshot, ui/units
- used by: app (objects store action, ribbon "More objects…"); blankDefinition/folderOf/answers/thumbnailSvg by other library code

## Problems found (finding IDs)
- F-0125 (S4): a role=menu without menu behaviour
- F-0122 (Also): disabled delete, "(2)" duplicates
- F-0115 (Also): this file's cache is the correct model

## To check in other files
- apptest: a double click on a card after the first click redrew the grid (does dblclick still reach the new card?)

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/ : the button needs aria-haspopup and aria-expanded; Enter/Space opens and focuses the first item; the menu follows the menu keyboard pattern (lines 177-209, F-0125)
