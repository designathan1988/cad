# src/ui/projects-dialog.ts
Lines: 132
Summary: The projects kept in this browser (IndexedDB through app/projects.ts): one row per project (the open one first and marked) with its name renamed in place, when it changed and how many elements, Open, Duplicate and Delete (asked first, cannot be undone), and New. Its own dialog frame (not openProjectDialog): own Escape (cancels the question, else closes), own focus restore, closing focuses the sidebar button.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: names renamed in place, changed date and size, open/duplicate/delete (asked first), new; the open one first
- 5-10 imports: App, project actions, ProjectInfo, el, i18n, icons
- 12-22 state (db, list, the project being asked about) and close (hide, clear, listener off, focus the sidebar button)
- 23-31 onKey (window capture): Escape cancels the delete question, else closes
- 32 when: short date and time in the language
- 33-36 refresh: the list from the database, then draw
- 37-42 button helper: a text button with a focus key and a class
- 43-47 draw: focus key kept; no database → message
- 48-70 the delete question: Cancel and Delete for good (deletes, refreshes)
- 71-72 no projects → message
- 73-111 rows: open one first; name input (Enter blurs, blur renames when changed); info; "open now" or Open (closes when opened, else refreshes); Duplicate; Delete asks
- 112-122 actions: New (when there is a database) and Close
- 123-127 the dialog drawn, shown, focus restored (or Cancel/Close)
- 128-131 the listener, the first draw, the list loaded

## Contracts, state and data flow
- Asynchronous: every action awaits the database and redraws; the open project's deletion is handled in app/projects.ts (another project opens).

## Depends on / used by
- uses: app/projects, io/project-db (type), ui/controls, ui/i18n, ui/icons
- used by: app (projects action, title bar's folder button, browser's Projects)

## Problems found (finding IDs)
- F-0114 (Also): a third dialog framework with its own Escape and focus rules

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString : options are Intl.DateTimeFormat's; dateStyle and timeStyle together give a short date and time per locale (line 32)
