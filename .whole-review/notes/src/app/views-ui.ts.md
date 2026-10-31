# src/app/views-ui.ts
Lines: 67
Summary: Saved views over the App: saving the current 3D camera and options or the plan's level/zoom/position/drawing scale (with the hidden categories and overrides) under the next free name; going back to one (level, what it shows, camera or plan framing, its drawing scale); deleting one.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: saving, going to, deleting saved views; app.ts delegates
- 3-9 imports: name/t, savePrefs, saved-views commands, readView3D, newId, App, drawingOf
- 11-14 doc of saveCurrentView: the next free name ("3D 1", "<level> 1")
- 15-28 3D: camera position and controls target (three.js), the 3D options; plan: level, scale, centre, the drawing scale shown now (the view's own, else the project's)
- 29-32 one command saving it with the hidden categories and the overrides; toast
- 34-41 goToView: its level (setLevel, even when that level was deleted: to check setLevel), its categories and overrides when stored
- 42-52 a 3D view: its options read as stored ones and saved to prefs; 3D shown; camera position and target set, up axis, controls updated, redraw. An orthographic camera's zoom is not saved nor restored (OrbitControls zooms an orthographic camera by camera.zoom, not by distance): a saved parallel view comes back at another scale (to check in scene-3d)
- 53-62 a plan view: plan shown, scale and centre, its own drawing scale for as long as it is shown (viewDen: F-0019 is about the scale list not clearing it); refresh
- 64-66 deleteSavedView: one command (a viewDen from the deleted view stays until something else changes it)

## Contracts, state and data flow
- Going to a view is not an undo step; it changes interface state only.

## Depends on / used by
- uses: app/saved-views.ts, app/view-3d.ts, app/persist.ts, app/document.ts (drawingOf), ui/i18n.ts, core/id.ts, three's OrbitControls via app.scene
- used by: app/app.ts (delegates), ui/browser.ts (views list), app/actions.ts (view.save)

## Problems found (finding IDs)
- F-0019 (confirmed path: goToView sets viewDen at 59)

## To check in other files
- app.ts setLevel with an id not in the levels
- render/scene-3d.ts: ortho camera zoom vs saved views

## Sources
- https://threejs.org/docs/pages/OrbitControls.html : update() after manual camera changes; target settable; orthographic cameras use min/maxZoom (lines 48-51)
