# src/app/frame.ts
Lines: 590
Summary: Draws one frame on every render: the plan with its whole overlay (or the 3D scene and its overlay), the temporary dimension value buttons/fields, the browser drawer and chrome, and the properties panel (rebuilt only when its key changes) with every panel action wired to commands; also the temporary dimensions of the selection and their edit fields.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: one frame of the views (plan overlay or 3D's) and the panel
- 3-40 imports: reference calibration draft, room tags, layer-set colours, keep-in-view 3D, object handles, units, measure parsing, vector, tolerance, wall/opening/room commands, measure-tool, arrange-walls, guide-tool, opening-ui, cursors, i18n, panel, snap labels, arc edit, registry, document helpers (drawingOf, levelOf, NO_LEVEL: the 3D overlay's level at 270-275 falls back to NO_LEVEL, F-0139; wallNumber), temporary view filter, stacked steps, temp dims, cut, edit tools, room ring test, prefs, id, App, next-element, ribbon-tabs lowerFirst, object names, PREVIEW_ID/SNAP_OF
- 42-49 nextTitle: the panel's title over a placing tool's next element ("Next ceiling", an object's own name, else its kind's name)
- 51-72 renderFrame start: the cursor taken again from the pointer (the view may have moved); narrow (≤900 px) layout: the panel waits hidden when nothing is selected with select or the browser is open, unless peeked; canvases and cube shown per view; the view corner and the 3D centre kept clear of the panel (scene.setCovered)
- 73-129 what the overlays need: preview ids (wall being drawn, opening being placed), the opening's rule guide, the wall segment being drawn (end, length, angle 0-360, direction), the floor outline's side, the measure tape and chain (stretches, closed area, its label), how far the preview reaches beside its line (so the measure sits off it), the snap's wall number and label (SNAP_OF for wall snaps), the lock label, the guide distance, the Modify marks, the rectangle's sides
- 130-247 plan: drawing settings at the view's scale, overrides/phases/room overrides when on, plan.draw(visibleGeometry, overlay): selection, hover, room space (or a closed measure chain), preview, drafts (dimension, grid, section, callout, calibrate, guide), the snap (for a fixed list of tools and handle drags) with its label and the direction it points away from, one measure label (guide distance, rectangle, Modify value, wall segment, floor side, chain, tape, bend, turn, opening guide), the axis line, reference lines, opening tags, handles, object handles, anchor, wall tags, room labels (name, short, area, or a not-enclosed / shared warning naming the other rooms), the draft polyline (chain, guide, floor, mark, beam/separator/curtain, roof, stair, railing), floor corners, the opening preview id, temporary dims plus the opening's and the guide's, the level below, acquired points, the circle guide draft, smart guides during moves. visibleGeometry() is computed twice here (135 and 188)
- 248-323 3D: visible geometry; x-ray; wall phases with their CSS colours (getComputedStyle per frame); opened openings; section box; ortho; style/quality; light; section plane; scene.sync; the cut at the level's cut height with that level's cut wall pieces; the cube; the overlay state (projection, the level's floor and height, the snap for wall/floor/measure/modify, the axis, one measure label, anchor, the same draft chain as in plan (copied, 296-315), box and its hot face, object handles, wall handles); overlay drawn
- 324-332 overlay canvas shown in 3D; the tool's cursor; timing marks; temporary dimension fields placed (plan only); browser drawer; chrome (renderChrome: the action list rebuilt every frame, F-0011)
- 333-343 the panel rebuilt only when the document object or a key of tool, level shown, selection, language, wall defaults, warnings, opening defaults/warnings/selected opening ends, the next element's key changes; else afterPanel
- 344-369 renderPanel input: document, selected walls, wall tool flag, defaults, the level shown (the next wall's, F-0030), warnings, selected openings (when no wall is selected), the level's rooms, placed openings and their warnings, the opening tool's size and side fields, the next element's fields, the selection count, the first registry kind with a selected element and its solids, stacked steps (computed over the whole document each rebuild)
- 370-401 panel actions (wall part): update walls, set reference line (changeReferenceLine), set wall type (changeWallType keeping the face against the room when "keep clear" is on), keepClear pref, reset to type, edit type, radius (bulge keeping its side), end joins (auto removes the key)

- 402-410 end joins written (an all-automatic wall loses its joins key); align/distribute walls in pick order (the first is the reference)
- 411-424 one wall selected: which screen sides its start and end are on (for the end-join fields' labels); the first selected wall's tag "Wall n"
- 425-448 wall defaults patched; close; open a section; interior elevations; calibrate; geometry for readouts; room actions (update one/many, level height, floor hole, clear holes, materials, floor layers, tiling, updateFloor folded over the ids into one command)
- 449-469 opening actions: update (patch or per-opening function, folded into one command), setRule (ruleKeepingPosition: switches an opening's placement rule keeping its position: fromOpening/aligned/inGroup are user-reachable rules here, the goal's root cause 2), align, align heads, distribute (new group), group spacing, ungroup
- 470-480 opening defaults patched; raw dispatch for registry kinds; align with the wall below (moveWalls of the upper wall by the step's shift); afterPanel
- 482-489 afterPanel: keep the selection in view (plan or 3D), rendering again if the view moved (a second render in the same frame)
- 491-505 currentDims: with the select tool and no drag, or a slide/move drag: the temporary dimensions of the selection on the document as dragged, measured only to what a temporary view shows
- 507-543 placeDims: keeps the value elements between renders by key (id + edit/show); removes the others; creates a field (focused, text selected) or a button; button text/aria; positions both at the plan's dimValueBoxes centres
- 545-553 dimButton: a click makes it the edited one and renders
- 555-589 dimField: text field with the value; Esc clears the error and closes; Enter parses the length, takes the dimension as it is now and its apply(value) command; refused or unparsable → footer error; else dispatch; blur closes (in Chromium a removed focused field blurs too: close then finds dimEdit already changed)

## Contracts, state and data flow
- Runs on every render. The plan and 3D branches each build their own copy of the measure-label and draft-polyline choices (130-247 vs 272-321), and keep two different lists of which tools show a snap (148 vs 271).

## Depends on / used by
- uses: the imports at 3-40 (renderers via App, ui/panel.ts, commands of walls/openings/rooms, tools)
- used by: app/app.ts (renderFrame, afterPanel, currentDims, placeDims, dimButton, dimField delegate here)

## Problems found (finding IDs)
- F-0011 (confirmed here: renderChrome every frame, 331)
- F-0014 the plan and 3D overlays each carry a copy of the drafts and measures

## To check in other files
- render/overlay-3d.ts and plan-view.ts: what each draws from these

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : -π..π; (deg + 360) % 360 maps to 0..360 (lines 79, 86)
- https://developer.mozilla.org/en-US/docs/Web/API/Element/blur_event : removing a focused element fires blur in Chromium, not in Firefox; blur does not bubble (lines 586, 512-514)
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select : select() selects all text, does not focus by itself (lines 525-526 focus first)
- https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle : returns a live object; reading it may flush style (line 252 every 3D frame)
