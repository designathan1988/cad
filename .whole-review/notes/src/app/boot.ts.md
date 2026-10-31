# src/app/boot.ts
Lines: 72
Summary: Chooses the project the app opens with: the last one open in the browser's IndexedDB (or the next readable one, saying when the last one could not be read); the first time, the old local-storage document becomes the first project; without a database, local storage only.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the last project from io/project-db.ts; the old single document migrated the first time; no database (a private window may have none) → the old way
- 6-10 imports: newId, project-db (list, load, open, save), repairProject and ReadError (project-file), Doc/newDocument, persist (loadDocument, prefs, saveTo)
- 12-19 interface Boot: doc, db (null without one), projectId, notOpened (the last project's name and read error when another was opened)
- 21 PROJECT_PREFIX 'project'
- 23-35 readStored(db, id, failed?): loadProject; absent → null; repairProject (as a file is read: migrated, bad elements dropped); not ok → warn, failed?.(error), null; fixes → warn; the document
- 37-46 boot(): openDb() null (no indexedDB) → local storage doc or a new one; the open promise rejected → warn and the same fallback
- 47-50 candidates: the last open project (prefs) first, then the list's other ids in its order (project-db: last changed first, per its comment)
- 51-63 the first candidate that reads: saving wired to it (saveTo), its id kept in prefs, returned with notOpened when the last one failed; a failure of the last one recorded with its name from the list
- 64-71 none readable or none at all: the old document (or a new one) saved as a new project, wired, kept, returned (with notOpened if the last one failed)

## Contracts, state and data flow
- listProjects/loadProject/saveProject rejections are not caught here: boot() rejects (to check in main.ts what happens then: a blank page?).
- When every stored project fails to read, a new project is created from the old local-storage document; the unreadable ones stay in the database, untouched.
- readStored warns about fixes in the console only: the user is told nothing about elements dropped when a stored project is opened at start (unlike opening a file, which toasts).

## Depends on / used by
- uses: core/id.ts, io/project-db.ts, io/project-file.ts (repairProject), app/document.ts, app/persist.ts
- used by: app/main.ts (boot()), app/projects.ts (readStored, PROJECT_PREFIX: to check)

## Problems found (finding IDs)
- F-0009 a stored project opened at start with elements dropped says so only in the console

## To check in other files
- app/main.ts: a rejected boot()
- io/project-db.ts: openDb returning null vs a rejecting promise; list order

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open : open returns a request at once and fails asynchronously through its error event (lines 38-46 rely on project-db turning that into a rejection)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining : failed?.(e) is skipped when failed is undefined (line 30)
