# src/app/persist.ts
Lines: 157
Summary: Saving in the browser: the interface preferences (localStorage), the old single document (localStorage) and the saving of the open project (to its IndexedDB record through io/project-db.ts when one is set, else localStorage): the latest version only, when the browser is idle, and at once when the page is hidden or closed.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: document and preferences apart; missing or full storage → keeps working unsaved, says so in the console
- 5-9 imports: Lang, readProject/repairProject, Doc, View3D, saveProject
- 11-12 keys: cad2.document.v1, cad2.prefs.v1
- 14-45 Prefs: language, theme, view, level, panel/browser open, 3D view mode, reference lines, opening tags, snaps, collisions, snap parts, keymap, plan view, project id, ribbon tab, keepClear
- 47-54 storage(): localStorage, or null when accessing it throws (blocked storage)
- 56-62 saveDocument: the document as JSON to localStorage; a failure (quota) logged
- 64-66 pending (the version waiting) and asked (a save scheduled)
- 68-78 target: the database and project id being saved to; saveTo sets it; savedAs reads it
- 80-94 flushSave: nothing waiting → done; else taken; no target → localStorage; else saveProject (per element, what changed), a rejection logged and the document written to localStorage instead
- 96-111 scheduleSave: keeps the latest; one idle callback (timeout 1 s) or a 200 ms timer
- 113-119 wireSaving: pagehide and visibilitychange→hidden flush (async IndexedDB writes there are best effort: the page may be frozen before the transaction commits; the idle save within 1 s keeps the loss small)
- 121-133 loadDocument: the old document read and repaired (fixes only in the console); unreadable → kept under .invalid with setItem OUTSIDE any try (F-0032)
- 135-139 validateDocument: the doc only when its only fixes are typed ids
- 141-148 loadPrefs: parsed JSON or {} (a stored "null" parses to null and is returned as Prefs)
- 150-156 savePrefs: merged and written, a failure logged

## Contracts, state and data flow
- Two flushes can overlap (an idle save still writing when the page hides): saveProject must tolerate concurrent calls on the same record (project-db.ts: to check, F-0001's file).
- The fallback to localStorage on a database failure may itself fail on quota (logged only): the user is not told the project is not saved.

## Depends on / used by
- uses: io/project-file.ts, io/project-db.ts, ui/i18n.ts (Lang), app/view-3d.ts (type)
- used by: app/boot.ts (loadDocument, prefs, saveTo), app/app.ts (scheduleSave, wireSaving, prefs), app/projects.ts (savedAs, saveTo, flushSave), ui dialogs (prefs)

## Problems found (finding IDs)
- F-0032 an unreadable old document too large to keep throws out of loadDocument

## To check in other files
- io/project-db.ts saveProject: concurrent calls; what "only what changed" compares against

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Storage/setItem : throws QuotaExceededError when storage is full or more space was refused (lines 58, 131, 152)
- https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event : hidden is the last reliable event; async work started then may not complete (lines 114-119)
