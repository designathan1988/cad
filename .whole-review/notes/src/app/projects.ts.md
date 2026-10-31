# src/app/projects.ts
Lines: 94
Summary: The projects kept in the browser's database: new, open, a file opened as a new project, list, duplicate, rename and delete. Switching saves the project left first and resets the store (its undo history left behind).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: kept projects; a new or opened project is another project, not an undo step; without a database the old way (app-files.ts)
- 6-12 imports: newId, project-db (delete, forgetSaved, list, save, ProjectInfo), i18n, App type, boot (PROJECT_PREFIX, readStored), document (newDocument, startLevel), persist (flushSave, savePrefs, saveTo)
- 14-29 switchTo: the waiting version flushed to the OLD target (flushSave reads target synchronously before saveTo changes it); the new target and prefs; errors, selection (cleared in place), drag reset; the start level; store.reset (no undo, a plain set + emit in core/store.ts:68-75, not the dispatch wrapper); both views framed again
- 31-38 newStoredProject: a new document saved under a new id, switched to, toast
- 40-50 openStoredProject: the open one → true; read (and silently repaired: readStored warns fixes in the console only, F-0009 applies here too); forgetSaved so the next save writes it whole; switch; toast
- 52-57 importAsProject: a checked file saved under a new id and switched to
- 59-63 projectsList: flush first so the open project's info is current, then the list
- 65-71 duplicateProject: the open doc or the stored one, saved under a new id named "… (copy)"
- 73-84 renameStoredProject: the open one through a command (undoable); another read, forgotten, saved with the new name; an empty trimmed name is accepted (to check the dialog)
- 86-93 deleteStoredProject: the open one gives way to the next readable project or a new one, then the record deleted

## Contracts, state and data flow
- Every function is async and lets database rejections through (await throws): the callers must catch (ui/browser drawer, input-buttons: F-0020 for the file path).
- store.reset does not run the dispatch wrapper's follow-ups (keepOpenings etc.), so this path is not part of F-0006 (which is about app-files' path through dispatch: recheck in verify).

## Depends on / used by
- uses: core/id.ts, io/project-db.ts, ui/i18n.ts, app/boot.ts, app/document.ts, app/persist.ts, core/store.ts (reset via app.store)
- used by: ui/browser.ts (project list actions), app/app-files.ts (importAsProject), app/app.ts (to confirm)

## Problems found (finding IDs)
- F-0009 (also here: a stored project opened from the list with elements dropped says so only in the console)

## To check in other files
- ui/browser.ts: catches rejections of these calls; rename refuses an empty name
- io/project-db.ts forgetSaved/saveProject (F-0001's file)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await : a rejected awaited promise throws there and, uncaught, rejects the async function's promise (all functions here)
