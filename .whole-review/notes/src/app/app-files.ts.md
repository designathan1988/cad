# src/app/app-files.ts
Lines: 93
Summary: The project as a file: rename (one undo step), save as JSON (download), the download helper, the file base name, a new project, and opening a JSON file (into the browser's project list when there is a database, else in place as one undo step).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: saving, opening and a new project, delegated from app.ts
- 3-9 imports: t, newDocument/startLevel, savePrefs, readProject/writeProject, App type, importAsProject/newStoredProject (projects.ts), safeFileName (app.ts: a value import from app.ts, a cycle app.ts ↔ app-files.ts resolved at call time)
- 11-16 renameProject: trims; same as stored → nothing; else a command setting name (an empty name shows "Untitled" by fileBase/renderChrome)
- 18-23 saveFile: writeProject(doc) downloaded as "<fileBase>.json", toast saved
- 25-33 download: Blob from the content, an anchor with href = createObjectURL and download = file name, click(), then revokeObjectURL at once (synchronously)
- 35-38 fileBase: the name (or untitled in the current language) through safeFileName
- 40-61 newProject: with a database, newStoredProject (async, not awaited: `void`); else clears error, selection and drag, a new document, start level saved to prefs, one undo step 'cmd.newProject' marked replaces (no edit follow-up between the two projects, F-0006), both views to be framed again, frameAll, toast with the undo key as the user has it (app.keyName)
- 63-92 openFile: readProject(await file.text()); failure → error in the footer and chrome redrawn; success → clears error/selection/drag, start level, the name from the file when the project has none (".json" dropped, any case), fixes counted except typedIds; with a database, importAsProject (awaited) and a toast; else one undo step replacing the document ('cmd.openProject' marked replaces: F-0006), both views reframed, toast with the undo key as the user has it

## Contracts, state and data flow
- Document replaced through store.dispatch (undoable), so the store's dispatch wrapper in app.ts (settleDimensions, keepOpenings, keepRooms) runs on a whole new document: it returns early for a changed document only if before/after walls are identical; for an opened project `next.walls !== before.walls`, so keepRooms(keepOpenings(before, next)) runs across two unrelated projects (to check in app.ts / keep-openings.ts / carry.ts: whether that moves anything of the opened project).
- file.text() decodes UTF-8 always; its rejection is not caught here (caller decides).
- The object URL is revoked in the same task as the click.

## Depends on / used by
- uses: ui/i18n.ts, app/document.ts, app/persist.ts, io/project-file.ts, app/projects.ts, app/app.ts (safeFileName)
- used by: app/app.ts (renameProject, saveFile, download, fileBase, newProject, openFile delegate here)

## Problems found (finding IDs)
- F-0005 download revokes the object URL right after click()
- F-0006 (to confirm in app.ts) opening or a new project passes through the store's keepOpenings/keepRooms against the previous project

## To check in other files
- app/app.ts store.dispatch wrapper (lines ~256-273): what keepRooms(before=old project, next=opened project) does
- app/input.ts: how openFile is called (awaited or void; a rejected file.text())
- app/projects.ts: importAsProject, newStoredProject

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static : revoke "when you've finished using an object URL"; the page does not settle the timing against a started download (to decide in verify)
- https://developer.mozilla.org/en-US/docs/Web/API/Blob/text : always decodes as UTF-8 (line 65)
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a : download works for same-origin blob: URLs, its value is the suggested name, / and \ become _ ; the page's example revokes "once the download has started"
