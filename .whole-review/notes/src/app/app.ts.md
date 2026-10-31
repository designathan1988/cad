# src/app/app.ts
Lines: 1835
Summary: The application object: the whole interface state (UiState, ~45 fields), the store wrapped so every edit also settles locked dimensions and, when walls change, keeps openings and rooms (keepOpenings/keepRooms; a whole other document put in place passes untouched); the derived geometry and refresh/render; and ~200 methods, most of them one-line delegations to the app/*-ui.ts modules, frame.ts and chrome.ts. Holds the renderers (plan, 3D, overlay, cube), the clipboard, the Modify tool's snapshots, the keymap and ribbon state.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header (and its blank line): the project changes only through the store; selection, tool, view, camera, language, theme are interface state outside undo
- 4-66 imports: ~60 modules (collisions, next-element, model import, reference UI, dimensions auto/constraints, layer sets, measure variables, keymap, arrange, object handles, kind tools, actions, units, the delegated UI modules view-ui/selection-ui/wall-ui/chrome/frame/modify-ui/room-ui/guide-ui/kind-tools/views-ui/app-files, three, store, vector, opening commands/style/schema, tools opening/measure/guide/wall/snap/dimension/modify, renderers plan/scene/overlay/cube, i18n, shell, select-drag, registry, carry/keep-openings, document (LEVEL_HEIGHT among them, at 65), drawing settings)
- 68-78 SNAP_OF: the snap kinds whose label names the wall ("ponta da parede 3")
- 79-92 more imports (geometry, opening marks, persist, boot, view keys, section box, temp dims, view-3d, modify tool, transform, opening derive, handles, id, room insideRing) after a declaration: imports are hoisted, order is cosmetic
- 94-95 MarkMode: angle | radius | coord (the measure marks tool)
- 97-205 interface UiState: every piece of interface state (view, tool, selection, hover, room space, tap confirm, level, theme, panel/peek/browser, hidden categories, temporary view, snaps, collisions, snap parts, Tab skip, lock (direction, label, at, by arrow|shift), acquired points, drawFrom, overrides on, guide mode/from, smart guides, wall defaults, wall/opening tool states, opening defaults by kind, snap, cursor, error, info, drag, floor draft, measure state/mode, dimension tool, grid/section/callout first points, calibrate, beamFrom (shared by beam, separator, curtain), object def and angle, doorFlip, handleDrag, opened openings, holeFor, ceilingTool, roof draft, stairFrom, railing draft, mark mode/draft, viewDen, guide draft, view3d, refLines, openingTags, wallFlip, modify, dimEdit)
- 207-213 PREVIEW_ID, afterColon (lower-case first letter), safeFileName (\ / : * ? " < > | → "-"), EDIT_LEVELS sentinel of the level list
- 215-240 class App fields: store, shell, plan, scene, cube, overlay3d, overlayState (redrawn as the camera turns), hotHandle, ui, geometry (derived), framed per view, savedPlanView/planViewKept/timer, panelDoc/panelKey, toastTimer, db and projectId from boot
- 242-247 constructor: db/project id from boot, prefs, language from prefs else navigator.language starting "pt" (BCP 47 tag), <html lang>
- 248-276 the store wrapper: every dispatch is wrapped; apply(before): changed = c.apply(before); same, or a command that replaces the document (open, new project: c.replaces), → changed as it is (F-0006); else settleDimensions(before, changed) (locked/equal dimensions) refused → before and a toast after; then if walls changed (by identity) keepRooms(before, keepOpenings(before, next)).doc (keepOpenings now moves an opening only with its own wall: F-0008)
- 277-342 ui initial state: view from prefs else plan; level = startLevel(doc, prefs.levelId); theme from prefs else prefers-color-scheme at that instant (not followed afterwards); collisions set as a side effect inside the literal (comma expression); defaults wall type = first type, centerline, base 0, top level+0; opening defaults with the oak panelled door and two-pane sliding window models (find(...)! : throws if those model ids vanish); objectDef 'def_table'; refLines/openingTags from prefs
- 343-346 saved plan view restored from prefs when finite and in range (scale 2..4000)
- 347-363 shell built; plan and 3D renderers on their canvases; trace preparing notice beside the style (refits the view bar); 3D overlay; view cube framing by the geometry's bounds and height, prepended to the view corner
- 364-369 scene.onChange: cube follows the camera, float bar placed again, and in 3D the overlay redrawn with fresh object handles and wall handles (recomputed every camera change)
- 370-379 geometry derived; saving wired; store subscriber: schedule a save, clear info, drop selected ids that no longer exist, refresh
- 380-385 ResizeObserver on the viewport: first framing once it has a size, else render; never disconnected (the app lives as long as the page)
- 386-392 theme applied, labels, cube labels, the boot's "could not open the last project" error, first refresh
- 394-396 height(): tallest wall top + its lift, at least LEVEL_HEIGHT (document.ts, 2.8 m; F-0139) (walls only: roofs, stairs, objects above walls are not counted)
- 398-402 lift(levelId): in 3D the exploded offset of a level (view-3d.ts liftOf), 0 in plan
- 404-435 section box and 3D view delegations to view-ui.ts: toggleBox, boxHot field, boxHandleAt, boxFaceOnScreen, setBox, toggleExplode, setView3D
- 437-482 refresh(): the derived geometry of what is shown, then render. Modify tool with a preview transform: transformSelection on the document as it was when the tool started (modifyBefore), then keepRooms(doc, keepOpenings(doc, shownDoc)).geometry. Else: an object preview (previewObject) or the drag's document (move/rotate: dragged walls, rooms moved with the drag transform, registry kinds moved by delta for move; slide: the openings and groups being slid; dimLine: the dimension's offset; other drags but marquee: dragged walls); walls changed by identity → keepRooms(keepOpenings) geometry; else geometryOf(shown) (cached) or deriveGeometry with the wall being drawn and the opening being placed. Runs on every pointer move during drags and tools
- 484-496 previewObject: an object handle drag patches the opening (opening handles) or the object (position and a parameter); the object tool in plan adds an OBJECT_PREVIEW object built by made() (the next object's type and values) at the snapped point
- 498-504 placeObject: chosen definition; a type given makes the next object's template that type with no own values; object tool on
- 506-510 turnObject: +90° modulo 360° for Space with the object tool
- 512-522 openingKind (door/window tool or null); previewOpening: while aiming, a preview opening with the defaults and the side toward the pointer
- 524-533 placedSides (swing toward the pointer unless flipped, hinge start unless flipped; flips only where a leaf hangs), placesLeaf (a door or a casement window)
- 535-553 placeSideFields: two segmented fields (swing side, hinge jamb) bound to doorFlip for the Place tab and panel; flipPlacing toggles one and refreshes (false when the tool places no leaf)
- 555-576 openingEvent: the opening tool's transition; on place, a new opening with a new id, its rule turned into a wall rule (wallRule: held by the wall, not by a neighbour), placementProblem refuses with a footer error (afterColon), else the tool goes idle and addOpening is dispatched (through the store wrapper)
- 578-583 previewProblem: the preview's overlap/outside warning as the footer's refusal text
- 585-632 room and floor delegations (roomSpaceAt, roomClick, floorClick, startFloorHole, addCeilingToRoom, addFloorToRoom, floorFinish, startCeiling); showProperties opens the panel and focuses its first control
- 634-678 selectedOpenings (solids of selected opening ids); wall-ui delegations: previewWall, wallTags, turnMeasure, bendMeasure, rectCorner, drawingEnd, oriented, toggleWallFlip
- 680-697 toggleOpeningTags (pref kept); openingTags(): the marks of the visible openings (D1, J2…) at markPoint 0.25 m off the frame, on the side away from an enclosed room
- 699-715 toggleRefLines (pref kept); refLines(): reference lines of every visible wall when on, else the selected ones and the preview; makeWall delegation
- 717-743 toScreen (plan transform, or 3D projection on the level's floor with its lift), projectAt (three's Vector3.project: world → NDC; z > 1 taken as behind the camera; NDC → viewport pixels), outlineOnScreen (plan polygon, or the convex hull of the projected prism corners in front of the camera)
- 745-798 setTool: floor tool with one room selected floors it at once (or selects its floor); door/window tool with one wall selected aims at its middle; resets every tool state (wall, lock, guide, acquired, room space, flip, opening, drafts, measure, dimension, first points, hole, ceiling, modify and its snapshot, snap, hover, error, info, measure field); clears the selection for any tool but select; then refresh
- 800-802 setView delegation (view-ui.ts)
- 804-829 frameFirst and keepPlanView (view-ui.ts), saved views save/go/delete (views-ui.ts)
- 831-834 contextPoint (where the context menu was opened, set by input.ts), openProjects (set by input.ts)
- 836-894 guide delegations (guide-ui.ts): level guides, shapes, guide tool mode, click, typed radius, start/move/offset/place/cancel/clear; addLevelMarkHere, addNoteHere (kind-tools.ts)
- 896-977 Modify tool state and delegations (modify-ui.ts): modifyBefore (geometry when the tool started), start, copy toggle (C), disjoin toggle (U), events, lastCopy (before/after documents, ids, delta, selection) for series "3x" and "/3", seriesReady, copySeries, split, corner, merge, canMerge, selection centre, modify marks
- 979-1006 arrangeItems: selected registry solids that move on their own (not walled, not endless, not walls), each with its plan box; arrange(how): too few → toast; else arrangeSteps per box, moveKinds per item folded over the document, one undo step 'cmd.arrange' with apply: () => next (the next document computed from the store's state at call time, not from the `before` the store passes: a dispatch between would be overwritten, but arrange is synchronous)
- 1008-1022 measure tool: toggle distance/chain (C) with a toast, measureEvent (transition, Esc clears the snap, field cleared, render)
- 1024-1056 kind tool delegations (kind-tools.ts): railing click/finish, stair click, roof click/finish, beam click
- 1058-1070 toggleOpen: the selected doors/windows opened in 3D, or all closed when all were open; info "n opened/closed"; refresh
- 1072-1084 curtain and separator clicks; drawingNow(): the project's drawing settings at a saved view's own scale while shown
- 1086-1125 setMarkMode (mark tool with a mode), markClick, columnClick, grid click/escape/draft, section click/escape (kind-tools.ts)
- 1127-1144 model import (model-import.ts), reference import and calibration (reference-ui.ts)
- 1146-1171 callout click and draft (plan only), section draft, the four elevations, interior elevations
- 1173-1184 autoDimension: walls selected on this level (or all outer walls) dimensioned by autoDimensions over a fresh deriveGeometry(doc) (not the cached this.geometry), one command, toasts
- 1186-1202 shown grids, dimension tool event/draft (kind-tools.ts), wallEvent delegation (wall-ui.ts)
- 1203-1217 checkLoop (an outline closed clockwise: said with the way back) and submitMeasure (footer field) delegations to wall-ui.ts
- 1219-1252 selection delegations (selection-ui.ts): select all walls, step through elements, nudge, clear, temporary hide/isolate, reset
- 1254-1278 setSnapParts (clamped 2..10, kept, toast), toggleCollisions (core flag, kept, toast), toggleSnaps (kept, toast saying the snaps' key as the user has it)
- 1280-1297 otherLanguage; setLevel: unknown id ignored; another level drops the saved view's scale; kept; selection, guide, info and error cleared; refresh
- 1299-1317 clipboard (document, geometry, ids, level at Ctrl+C), copySelection/paste/deleteSelection delegations
- 1319-1351 chainStepBack: drawing a chain whose last step is the last addWalls and the last wall ends at the chain's point: undo it and go on from its start (Backspace / Ctrl+Z); undo/redo with the command's label in the toast
- 1353-1377 seen* keys for keeping the selection in view (view-ui.ts), keepSelectionInView, covered, frameAll
- 1379-1402 elevation (orthographic view from a side), sectionAtGuide/clearSection, frameSelection (view-ui.ts)
- 1404-1424 setLanguage (i18n, <html lang>, kept, relabel shell and cube, render); toggleTheme (kept); applyTheme: data-theme on <html>, the scene's colours read from the computed CSS custom properties
- 1426-1467 file delegations (rename, save, download, openSections set by input.ts, fileBase, keyView, newProject, openFile)
- 1469-1477 toast: text, shown, hidden after max(2.5 s, 1.5 s + 50 ms a character)
- 1479-1501 levelBelow (the highest level under this one), underlay (its wall pieces, none when walls are hidden), selectionKinds, selectedWalls
- 1503-1528 ?perf timing: marks, lastFrame; render(): units and named variables set as module state from the document (setUnits, setVariables), keepPlanView, renderFrame (frame.ts), phases logged with ?perf
- 1530-1546 pointer (client px, set by input.ts); pointerWorld: plan inverse transform or the 3D ground point on the level's floor; renderFrame delegation
- 1548-1579 afterPanel, currentDims, placeDims, dimButton, dimField (frame.ts)
- 1581-1602 handles(): none outside select or during move/marquee/dimLine drags; the selected walls of this level (or as dragged) projected to the screen (plan transform, or 3D on the level's floor; behind the camera at -1e6); plan avoids the temporary dimensions' value boxes; one door selected and still: its flip controls
- 1603-1619 the door's flip controls returned with the handles; selectedDoor (one door with a swinging leaf); flipDoor: swing side or hinge jamb flipped by updateOpening (through the store wrapper)
- 1621-1641 joinedAsShown: with walls hidden/isolated for a while, the shown walls derived again on their own (joins among themselves), cached by geometry and temp view; openings being placed kept as they were
- 1643-1672 visibleGeometry: temporary view, then hidden categories; in 3D the levels shown (walls, their openings, rooms, kinds by level, null level = every level); in plan only the current level's walls, their openings, rooms and kinds
- 1674-1691 toggleBrowser: drawer open state kept; the plan pans only by what the drawer newly covers of the model's left edge; focus to the drawer's first button or back to its toggle
- 1693-1699 a stale doc comment ("Shows or hides a category…") over toggleOverrides, then its own comment; toggleOverrides flips the view's overrides with a toast
- 1701-1725 layer sets: apply (hidden categories replaced, selected ids without a visible solid dropped, toast), save under the next free name (one command), delete
- 1727-1734 toggleCategory: hide/show; selected ids without a visible registry solid dropped (hasSolid over kinds)
- 1736-1747 a stale doc comment ("Every wall of a type…") over selectSimilar's; selectSimilar and selectWallsOfType delegations
- 1749-1788 fields set by the input layer and chrome: browserKey, openLevels/openWallTypes/openMaterials/openUnits/openObjects/openOverrides, keymap (prefs), setKeymap (kept, render), objectClick, actionList, keyName(id) (the action's key as the user has it, or its name in quotes when it has none: what the {key} messages say, F-0010), ribbonTab (prefs), ribbonKey, next (templates of the next elements by slot), ribbonAway, ribbonSelected
- 1790-1803 chooseRibbonTab: the context tab is not remembered; another tab while something is selected or a tool is on marks ribbonAway; kept; chrome redrawn; renderBrowserDrawer delegation
- 1805-1824 togglePanel (open and peek set together, kept), renderChrome and measureHint delegations
- 1826-1834 a stale doc comment ("The selection's quick actions…") over openCommands; floatKey; placeFloatBar delegation

## Contracts, state and data flow
- The wrapper (256-275) is the single path of every document change: a replacement (c.replaces) passes as it is; an edit gets settleDimensions, then keepOpenings + keepRooms when walls changed by identity. keepOpenings moves an opening only with its own wall (F-0008); settleDimensions acts only on dimensions the user locked; keepRooms keeps rooms' seeds in their rooms.
- Theme follows the system only at start (matchMedia read once).

- Responsibilities mixed in one class (goal's root cause 3): interface state, document-change policy (the store wrapper), geometry preview for drags/tools (refresh), opening placement (openingEvent), arrange, clipboard, layer sets, ribbon state, toasts, theme/language, plus delegations. The delegations are thin; the policy pieces (wrapper, refresh's drag cases, openingEvent) are the real logic here.
- refresh() and render() run on every pointer move during drags; refresh re-derives geometry (keepOpenings/keepRooms on drags of walls).

## Depends on / used by
- uses: nearly every module of app/, tools/, render/, ui/shell.ts, ui/i18n.ts, ui/units.ts, core/store.ts, elements/registry.ts and opening/dimension/zone modules (imports at lines 4-92)
- used by: app/main.ts (new App), and as `App` type by every app/*-ui.ts, frame.ts, chrome.ts, input*.ts, kind-tools.ts, ribbon-tabs.ts, actions.ts, ui dialogs

## Problems found (finding IDs)
- F-0006 fixed (a command that replaces the document skips the edit follow-ups, 262-264)
- F-0007 three stale doc comments (1693, 1736, 1826)
- F-0008 fixed (in keep-openings.ts: no hidden link to a neighbouring wall)

## To check in other files
- style.ts OPENING_MODELS has 'doorPanelsOak' and 'winSliding2'
- height(): roofs and other kinds above the walls are cut off by framing? (view-ui.ts frameAll / scene.frame)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver : callbacks run in the rendering update before paint; resizes in the callback re-run layout (lines 381-385)
- https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia : .matches is a one-time read; live changes need the change event (line 286)
- https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language : BCP 47 tag such as pt-BR (line 246)
- https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/getPropertyValue : custom properties read from the computed style (line 1423 trims them)
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset : dataset.theme ⇄ data-theme attribute (line 1421)
- https://raw.githubusercontent.com/mrdoob/three.js/r176/src/math/Vector3.js : project(camera) = applyMatrix4(matrixWorldInverse).applyMatrix4(projectionMatrix) into NDC (lines 725, 738); behind a perspective camera NDC z > 1 (the threejs.org docs index did not hold the method page)
- https://en.wikipedia.org/wiki/Command_pattern : a command carries all it needs to act: here also whether it replaces the document (F-0006)
