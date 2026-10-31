# src/app/saved-views.ts
Lines: 122
Summary: Saved views in the document: a 3D view (camera position/target, its View3D settings) or a plan view (level, zoom, centre, drawing scale), with what they show (hidden categories, overrides); the commands that save, delete, rename/caption and reorder them; the next free name; and the file reader's guard.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: Revit/ArchiCAD views; in the document; saving and deleting are undo steps; going to one changes only the interface
- 5-10 imports: Category, isCategoryList, Command, Point2, Doc, View3D
- 12-16 Shows: hidden categories and overrides on
- 18-31 SavedView 3D: id, name, kind, level, caption (kept from the tour, taken out), camera position and target (three.js, y up), View3D
- 32-44 SavedView plan: id, name, kind, level, caption, scale (px/m), centre, drawing scale den
- 46-50 nextViewName: the first free "base n" (the same loop as layer-sets.ts nextName: two copies)
- 52-55 saveView: appended (no guard)
- 57-60 deleteView: removed by id, unchanged when absent
- 62-78 updateView: name (trimmed, kept when blank) and caption (empty = none); NOT used anywhere since the tour was taken out
- 80-91 moveView: swaps a view with its neighbour ("the tour's order"); NOT used anywhere since the tour was taken out
- 93-94 finite and triple guards
- 96-102 isSavedView: id, name, level strings; caption string; hidden a category list; overrides boolean
- 103-115 a 3D view: position and target triples; view3d with levels all/below/current and explode/cut/xray booleans (other View3D fields are filled by readView3D when applied: views-ui.ts:44)
- 116-121 a plan view: positive finite scale, finite centre, positive den when given; any other kind refused

## Contracts, state and data flow
- Applying a 3D view goes through readView3D (views-ui.ts:44), so older views lacking box/ortho/style/quality are completed.

## Depends on / used by
- uses: app/layer-sets.ts (isCategoryList), core/store.ts, app/view-3d.ts (type), app/document.ts (type)
- used by: app/views-ui.ts (deleteView, nextViewName, saveView), io/project-file.ts (isSavedView), app/document.ts (SavedView type)

## Problems found (finding IDs)
- F-0036 updateView and moveView left without a caller after the tour was taken out (with their i18n labels, and the sheets' cmd.updateViewport/cmd.moveViewport labels)

## To check in other files
- ui/i18n.ts: other labels of removed areas left (cmd.updateViewport, cmd.moveViewport seen at i18n.ts:1825-1826)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring : [a[i], a[j]] = [a[j], a[i]] swaps; the right side is built first (line 88)
