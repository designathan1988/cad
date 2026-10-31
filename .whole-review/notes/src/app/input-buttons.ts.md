# src/app/input-buttons.ts
Lines: 99
Summary: Wires every fixed button of the shell to the app: top bar (undo, redo, projects, views, level list, language, theme, save, open, rename, panel), File menu (from FILE_MENU and the action list), ribbon wheel scrolling, footer toggles, the view bar (levels shown, explode, cut, x-ray, box, ortho, style, quality, scale, visibility, show all, light sliders), temporary view reset, shortcuts and commands.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the top bar, tool bar, 3D bar, file, language and theme buttons
- 4-13 imports: t, setDrawing (drawing-dialog.ts), drawingOf, App/EDIT_LEVELS, showLevels, showMenu, FILE_MENU, view-3d types, renameInPlace/showHelp (input.ts: a cycle input.ts ↔ input-buttons.ts)
- 15-21 undo, redo, projects (home), 3D, plan
- 22-28 the level list: its last entry opens the levels dialog (the list put back to the level shown), else setLevel
- 29-39 language, theme, save, open (the hidden file input), rename in place, the file input's change: the file taken, the input cleared (the same file can be chosen again), openFile not awaited (`void`: a rejection is never handled: F-0020); panel toggle
- 40-57 File menu: its entries from FILE_MENU looked up in the action list (label, keys, enabled), separators where '-' falls between items
- 58-67 the ribbon scrolls sideways with the vertical wheel when it overflows (non-passive listener, preventDefault)
- 68-71 snaps, collisions, Finish (runs the tool.select action), snap parts list
- 72-77 view bar: levels shown, explode, cut, x-ray, box, ortho
- 78-85 style (the photorealistic one announced with a toast first), quality
- 86 the plan scale list sets the PROJECT's drawing scale (setDrawing) without clearing a saved view's own scale (ui.viewDen), unlike the drawing dialog: F-0019
- 87-98 visibility (view.overrides action), show all (view.tempReset action), light panel toggle and sliders (brightness, sun), temporary view reset, shortcuts help, command palette

## Contracts, state and data flow
- Some buttons run actions from the action list by id (tool.select, view.overrides, view.tempReset, File menu), others call app methods directly: two paths for the same commands (goal's root cause 1 in a small way).

## Depends on / used by
- uses: ui/drawing-dialog.ts, ui/levels-dialog.ts, ui/menu.ts, app/ribbon-tabs.ts (FILE_MENU), app/input.ts (renameInPlace, showHelp), App
- used by: app/input.ts (wireButtons)

## Problems found (finding IDs)
- F-0019 the plan scale list does not clear a saved view's own scale
- F-0020 opening a file: a rejected promise goes unhandled

## To check in other files
- app/views-ui.ts goToView: how viewDen is set
- app/projects.ts importAsProject: can it reject (IndexedDB)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event : an unhandled rejection only reaches the console; the user is told nothing (line 37)
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file : value = '' empties the list so the same file fires change again; a File taken before stays usable (lines 35-37)
- https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener : passive defaults to false on ordinary elements; { passive: false } lets preventDefault stop the scroll (lines 59-67)
