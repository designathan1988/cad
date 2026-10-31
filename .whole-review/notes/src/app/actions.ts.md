# src/app/actions.ts
Lines: 260
Summary: The list of every named action (tools, views, edit, file, settings, levels, help): id, translated label and group, search keywords in both languages, its key (own or remapped by the user), enabled state and what it runs. The palette, the ribbon, the File menu, the keyboard (input-keys.ts byKey), the help and the tips read this list; keys are resolved through app/keymap.ts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the list is the single place for names and keys (palette, toolbar, keys, menus)
- 5-16 imports: keyOf (keymap), arrange helpers, newId, distributeOpenings, GROUP_PREFIX, addZone, zone colours/prefix, words (object names), i18n t/tBoth/name, App type, canTransform, CATEGORIES (geometry: the one list of hideable categories, F-0107)
- 18-31 interface Action: id, label, group, keywords, keys (current: own or remapped, absent when turned off), defaultKeys (own), enabled, run
- 33-34 tipOf: a button's tip for an action, "name (key)" with the key as the user has it, the name alone without one (the title bar, the float bar and the tests use it: F-0010)
- 36-52 interface Openers: dialog/file-picker openers the input layer provides (help, levels, wall types, materials, units, objects, openings, floors, presets, openFile, projects, drawing, keys, variables)
- 54-70 appActions(app, open): reads ui, store, doc, has-selection; make(): builds an Action, keys = keyOf(id, own key, app.keymap); label t(key, vars); keywords = tBoth(key, vars) + extra words; conditional spreads add keys/defaultKeys only when set (exactOptionalPropertyTypes)
- 71-77 group message keys
- 78-107 tool actions: select V, wall W, rect wall "W, Q" (setTool then wallEvent rect), arc wall "W, A", floor L, ceiling (startCeiling), door D, window Shift+W, room R, measure M, railing G, stair E, roof T, beam B, separator, curtain, guides line/point/circle, column P, grid Shift+G, dimension Shift+D
- 108-117 one action per object definition (tool.object.<id>), built WITHOUT make(): no keyOf, so it can never carry a key or a remapped one; keywords in both languages
- 118-129 views: 3D 1, plan 2 (each disabled when shown), frame selection F, frame all Home, levels shown all/below/current, explode, cut, xray, box, ortho
- 130-146 zone.make: the selected rooms of the first one's level become a zone named zone.default n = zones.length + 1, category social; the zone becomes the selection and the panel opens
- 147-150 section at the selected straight guide (and flipped), section off, the four elevations
- 151-175 edit: undo/redo (enabled by the store), delete, select all walls, select similar, clear, the six Modify tools with Shift keys (enabled by canTransform), copy/paste to the clipboard, split, corner, merge, clear guides, temporary hide/isolate/reset, a selected door's hinge flipped H (edit.flipHinge, enabled by app.selectedDoor: the context menu's key comes from here), next/previous element N/Shift+N
- 176-190 file: projects, new, open Ctrl+O, save Ctrl+S; settings: snaps S, collisions K, theme, language Shift+L, panel, browser, reference lines, opening tags; one show/hide per category of CATEGORIES (188-190)
- 191-201 one action per level, highest first (level.<id>), not via make (no key possible)
- 202-215 save view, sections dialog, section tool, model import, reference import, callout tool, mark angle/radius/coord (setMarkMode), automatic dimensions, the four elevations as marks, text and level mark tools
- 216-223 one action per saved view (view.go.<id>), not via make
- 224-234 levels dialog, wall types, materials, objects, presets store, floors store, openings store, units; snap parts 2..10 made with make() WITHOUT vars (so label and keywords are computed with an unfilled {n}) and then the label alone is replaced with the filled one
- 235-248 align/distribute: n = arrangeItems(); doors and windows of one wall selected: spreadX/spreadY distribute them on the wall with equal spaces (distributeOpenings), else app.arrange(how), enabled when n >= arrangeNeeds(how)
- 249-259 variables, graphic overrides (open, toggle enabled when any override exists), save/apply layer sets, keys dialog, drawing scale and pens, help ?, the command palette Ctrl+K (help.commands, app.openCommands)

## Contracts, state and data flow
- Called on every chrome render (app.actionList), by the palette and on each key press that reaches input-keys' byKey: it builds ~200 objects and calls t()/tBoth() each time; pure but for app reads; actions run against the app.
- Keys: make() is the only path through keyOf, so the keymap reaches only make() actions. The context menu, the float bar, the footer, the title bar, the help and the keyboard read these Action.keys (F-0003, F-0010, F-0021).

## Depends on / used by
- uses: app/keymap.ts (keyOf), app/geometry.ts (CATEGORIES), tools/arrange.ts, core/id.ts, elements/opening/commands.ts (distributeOpenings), elements/zone/*, elements/object/fields.ts (words), ui/i18n.ts, tools/transform.ts (canTransform), App methods
- used by: app/input.ts (appActions with openers; palette, app.actionList, help), app/chrome.ts (renderRibbon and the tips read app.actionList), app/input-keys.ts (actionOfKey over actionList), app/context-menu.ts (keys), tests/app/actions.test.ts, tests/ui/consistency.test.ts

## Problems found (finding IDs)
- F-0003 fixed: the context menu, the floating bar and the ribbon's contextual tab take their keys from here (edit.flipHinge and help.commands added for the two that had none)
- F-0004 snap parts keywords built with an unfilled {n}
- F-0107 fixed: the categories' show/hide actions read geometry.ts's CATEGORIES

## To check in other files
- ui/i18n.ts t(): what an unfilled {n} renders as (F-0004)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : ...(cond ? {k} : {}) adds k only when cond (lines 64-65); later properties override earlier (line 229 replaces label)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing : ?? falls back only on null/undefined (lines 61-62: extra.keywords ?? '', extra.enabled ?? true keeps an explicit false)
- https://en.wikipedia.org/wiki/Single_source_of_truth : the other places refer to this list instead of copying its keys (F-0003 fix)
- https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html : (typeof list)[number] is the type of a list's elements (Category from CATEGORIES, F-0107)
