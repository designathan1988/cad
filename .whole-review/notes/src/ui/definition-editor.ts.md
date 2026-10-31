# src/ui/definition-editor.ts
Lines: 622
Summary: The object definition editor (no code): a draft of a definition edited in a modal over five tabs (parameters, parts, handles, types, rules), with names and category/folder, a live three.js preview turned by dragging, sliders that flex each free parameter, and a status line of problems; saved as one undo step or dropped. The whole dialog is rebuilt on each change, focus restored by data-focus keys.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: draft, tabs of fields, formulas, live preview, flex sliders, problems
- 8-22 imports: previewMesh, SEE_THROUGH, object geometry helpers, three, RoomEnvironment, App type, definition commands, evaluate, words, formula parse/evaluate, schema types, isDefinition, el, i18n, icons
- 24-28 Tab, TABS, parameter KINDS, CATEGORIES, NAME (a parameter name: letter/_ then word chars, Latin accents)
- 30-35 exprOf (a plain number stays a number, else a formula string) and exprText
- 37-46 editDefinition state: helpBack overlay, draft (structuredClone), tab, flex values, yaw/pitch, preview
- 47-63 close (removes the key listener, disposes the preview, hides the overlay), onKey (Escape closes, window capture: F-0113), set (draft and redraw)
- 65-77 problems: bad and repeated names, no type, the evaluation's problems and warnings; previewInstance at the origin with the flex values
- 79-127 field helpers: text input (formula marked invalid while typing, Enter blurs, change commits), select, remove and add buttons, bilingual words input (the current language's side), replaceAt, column heads, material options (material params then project materials)
- 128-174 paramsTab (after its section comment): per parameter name, label, kind, default (material select or number), min, max, formula, remove; add with a free pN name; a note
- 176-192 renameParam: the name replaced in formulas under a fixed list of keys, part materials, handles, type values, rules, light (misses round/tilt/roll/turn/d and points: F-0111)
- 194-280 partsTab cards: per part its kind, name, definition (object part) or material, void checkbox, remove; position x/y/z; size fields by kind (box w/d/h/round/tilt/roll/turn, mesh w/d/h, cylinder r/r2/h/tilts, sphere r/ry/h/tilts, profile/revolve points textarea "x; y" per line, object angle); repeat count/dx/dy/dz and when
- 281-292 blank parts per kind (box, cylinder, revolve, profile, sphere, object of the first other definition)
- 293-321 the light card (x, y, z, watts, kelvin), removable
- 322-338 the cards, the light, add buttons per part kind and light, a note
- 340-365 handlesTab: per handle a free numeric parameter, axis, sign, at x/y/z formulas, shift, remove; add; note
- 367-415 typesTab: per type its name, remove (kept when last), a value per free parameter (material select or number, empty = default); add with a free typeN id; note
- 417-435 rulesTab: per rule its condition formula and message, remove; add; note
- 437-452 draw: the focused field's key kept; the names datalist; the tab bar (role tab with aria-selected and aria-pressed); the body of the current tab
- 453-473 the preview canvas reused; sliders for numeric free parameters (range min/max from the parameter or around the value, 200 steps), input updates the preview, change redraws
- 474-490 status (problems or all good); names pt/en (empty keeps the old), category, folder with the project's folders offered
- 491-502 save (enabled when the definition validates and names are good and unique: dispatch add/update, close) and cancel
- 503-521 the dialog (role dialog, aria-modal), the overlay shown, the preview created once, updated, focus restored
- 523-563 Preview: WebGL renderer on the canvas, room environment (PMREM), hemisphere and sun; drag turns yaw/pitch (pointerup only)
- 564-589 update: evaluation with the flex values; old meshes' geometry and material disposed but not their edge children (F-0112); cut solids plus faint red voids; edges; the framing box
- 590-601 render: size from the canvas, camera on a sphere around the centre at a distance fitting the radius in the field of view
- 602-612 dispose: meshes (not edges), renderer, forceContextLoss to free the context at once
- 614-616 the Escape listener (window, capture) and the first draw
- 618-621 withoutKey: a copy without one key

## Contracts, state and data flow
- The draft lives only here until save; one dispatch (addDefinition/updateDefinition). Each change rebuilds the whole dialog and re-evaluates the definition twice (problems and sliders) plus once for the preview.

## Depends on / used by
- uses: render/pattern-texture (previewMesh), elements/material/schema, elements/kinds/object, three, elements/object (commands, evaluate, fields, formula, schema, valid), ui/controls, ui/i18n, ui/icons
- used by: ui/objects-dialog.ts (new and edit)

## Problems found (finding IDs)
- F-0111 (S3): rename misses formula fields
- F-0112 (S3): edge lines leak on every preview update
- F-0113 (S3): Escape in any field closes the editor and drops the draft

## To check in other files
- other dialogs that close on a window capture Escape

## Sources
- https://threejs.org/docs/pages/BufferGeometry.html : dispose frees the GPU resources; call it whenever the instance is no longer used (lines 564-611, F-0112)
- https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener : capture listeners run before the target's listeners, so a field's stopPropagation cannot stop a window capture handler (lines 54-59, 87-90, 614; F-0113)
