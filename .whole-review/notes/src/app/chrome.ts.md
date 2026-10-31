# src/app/chrome.ts
Lines: 631
Summary: Renders the interface around the views on every render: the browser drawer (cached by a key), the title bar (its tips and the search's key cap from the action list), the ribbon (cached by a key, from the action list plus the context entries), the 3D and plan view bars, the level list, the footer's hint, key hints and measure field, the tool's Finish button, and places the floating bar over the selection (plan or 3D) clear of the panel, handles, dimension values and labels.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the interface around the views (tool bar, level list, footer hints and keys, float bar, browser drawer), functions over the app
- 3-28 imports: vector, object names, units text, three, opening rule text, measure-tool readings, opening-ui, i18n, icons, controls, keyHint (shell), registry, document helpers, drawing scales, geometry bounds/opening outline, browser drawer, ribbon renderers, ribbon tabs, view-3d lists, context entries, tipOf (actions), float bar placement, room area, App, EDIT_LEVELS
- 30-31 SNAP_PARTS: the division counts of the footer's list, a second copy of the palette's list (actions.ts:226)
- 33-48 renderBrowserDrawer: hidden/aria-pressed from ui.browserOpen; rebuilt only when a JSON key of what it shows changes (language, view, level, hidden, toggles, levels, types, walls' types, views, units, materials, layer sets, override count); the focused button's index kept across the rebuild
- 50-62 renderChrome start: panel toggle pressed, project name, saved-where note, document title, undo/redo enabled, 3D/plan pressed
- 63-89 the title bar's (undo, redo, commands, shortcuts, language, save, open), the snaps button's and the view buttons' tips from the action list: tipOf = name and current key (the user's), written only when they change (the view buttons' aria-label left to their words); the command search's key cap = help.commands' key, hidden when it has none
- 90-108 ribbon; language button; theme icon rewritten only when it changes (a click mid-press survives); snaps and collisions pressed; snap parts list rebuilt per language (foot.parts), its value, disabled with the snaps off
- 109-150 the view bar: 3D-only and plan-only groups; scale list per language (SCALES), the scale the plan is drawn at shown (app.drawingNow(): a saved view's own while it is on, F-0019); show-all button with a temporary view; levels shown, explode (pressed when spreading, aria-disabled with one level), x-ray, box, ortho, cut; style and quality lists per language, set to the view's
- 151-161 light panel: captions, slider values (not overwritten while focused), percentages, aria-expanded
- 162-169 level list rebuilt when the levels or language change (highest first, then "Edit levels…"); a level that no longer exists replaced by the first one IN renderChrome (state written during a render); value set
- 170-181 empty-project hint (no element and the select tool), its text with the wall tool's current key (app.keyName); temporary view frame and chip with the count
- 183-227 footer hint key: wall tool states (rectangle, bend, idle line/arc/rect, drawing with ≥2 walls), drag kinds (slide, move, handle drags, bulge, marquee crossing/window), selection (several of one or mixed kinds, one with or without temporary dimensions), nothing
- 228-237 opening tool: aiming → its problem, or the rule text (with a swing clash variant); else "place a door/window"
- 238-289 per-tool hints (split, corner, room with its area, floor/hole/ceiling (hint.floorPlace with the floor tool's current key), measure, dimension, grid, section, callout, calibrate, guide, column, object, beam, separator, mark, curtain, note, level mark, roof, stair, railing)
- 290-299 guide hint (its distance and base wall number), Modify hint by kind and step; the footer text = error ?? guide ?? modify ?? info ?? opening ?? tool ?? hint
- 300-314 Alt for a guide in plan; the lock arrows while a point is drawn from another; the action list's current keys by id (once per render), actionHint(id, words): the hint with that key, none when the user turned it off; the snaps' hint
- 315-408 the footer's key hints per state: the actions' keys from actionHint (snaps, delete, frame, clear, flip hinge, commands, select all, shortcuts: F-0010 fixed); the tools' own keys (Esc in a tool, Shift, Enter, C, U, Q, A, H while placing, ⌫, Space, arrows) are no actions and stay written here
- 409-441 the measure field: which kind of value it asks (sides, angle, factor, distance, radius, length+angle, point, length, distance, measure), its label, its aria-label "Measure: <kind>", its placeholder with typing examples
- 442-449 the wall tool's arc/rectangle buttons pressed on the ribbon (found by data-action); cursor coordinates; the footer and the view bar fitted; the float bar placed
- 451-471 measureHint: idle (distance/chain start), from, chain (total, count, last stretch, angle at the last corner), chain done (closed: area, perimeter, count; open: total), distance reading (length, |dx|, |dy|, angle)
- 473-495 placeFloatBar: the selection's context entries (context-menu.ts) as icon buttons, titled tipOf(entry) with the action list's current keys (F-0003 fixed); rebuilt when the language, the set of ids or any entry's key changes; a click looks the entry up again for the selection at that moment
- 496-552 where: hidden unless the select tool with no drag and a selection with bounds; plan: the box's screen corners; 3D: every vertex of selected openings (outline × bottom/top), registry solids with a span, and wall pieces, projected with their lift (points behind the camera dropped); none in front → hidden
- 553-572 size (offset size, or 104 × 36 before its first layout: offsetWidth is 0 while hidden); never under the panel where it covers the drawing (bottom sheet / right drawer); clear of the handles (24 px boxes), the temporary dimensions' values and the plan's label boxes (placeBarY); clamped inside the free part
- 574-614 renderRibbon: actions by id from app.actionList(); with a selection, the context entries added as ctx.<id> with the action list's keys; the shown tab (a vanished or "context" remembered tab → the first); the contextual tab forward unless the user went elsewhere for this same tool+selection; rebuilt only when a JSON key of language, tab, selection, tab names, each button's [id, label, keys, enabled, pressed] and panel field keys changes; focus kept on the same action button or field
- 616-625 renderToolDone: the view bar's "Finish (Esc)" while a tool is on, its text set once per language ('Esc': the tools' own way out, no action)
- 627-631 objectName: the object tool's definition name in the interface's language

## Contracts, state and data flow
- renderChrome runs on every render (pointer moves during drags and tools included): it rebuilds the footer's keys (replaceChildren), calls app.actionList() (~200 Action objects with t()/tBoth() each) for the tips, for the footer and in renderRibbon before its cache key can decide nothing changed, and contextEntries in renderRibbon and placeFloatBar (also on every 3D camera change through scene.onChange) (F-0011).
- Keys reach the screen from one source, the action list (app/actions.ts through keymap.ts): the ribbon, the title bar, the footer, the float bar and the context menu. The tools' own keys (not actions) are written literally.

## Depends on / used by
- uses: ui/shell.ts (keyHint, parts), ui/ribbon.ts, app/ribbon-tabs.ts, app/context-menu.ts, app/actions.ts (tipOf), ui/browser.ts, ui/bar-place.ts, app/view-3d.ts, tools/measure-tool.ts, tools/opening-tool.ts, app/opening-ui.ts, app/geometry.ts, app/document.ts, elements/registry.ts, ui/i18n.ts, ui/units.ts, three
- used by: app/app.ts (renderChrome, renderBrowserDrawer, measureHint, placeFloatBar delegate here), app/frame.ts (via renderChrome)

## Problems found (finding IDs)
- F-0010 fixed: footer, title bar, view buttons, search cap and empty hint take the user's keys
- F-0003 fixed (seen here too: ribbon ctx.* buttons and the float bar)
- F-0011 the whole action list rebuilt on every render (now three times per render: tips, footer, ribbon)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement/Option : new Option(text, value) (the lists rebuilt per language)
- https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren : replaces all children (lists rebuilt, line 407 footer keys); says nothing about focus
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetWidth : 0 when the element or an ancestor is display:none (lines 552-553 fall back to 104 × 36)
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus : focuses only a focusable element; returns nothing (lines 47, 611-612)
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed : toggle buttons with a constant label and aria-pressed (lines 53, 61-62)
- https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html : the same function identified consistently (F-0010 fix)
