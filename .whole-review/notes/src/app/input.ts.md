# src/app/input.ts
Lines: 1067
Summary: Wires all pointer and keyboard input in one closure: the dialogs' openers and the action list, the context menu, tracker and marquee, world points (plan, 3D floor, 3D surfaces), snapping inputs for every tool, picking, then per-tool behaviour for pointer move, press, right click and release as long if-chains, the measure field's keys, Alt guides, arrow/Shift locks, Tab snaps, project rename and the shortcuts help.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: plan wheel zoom and middle pan; 3D wheel zoom, middle pan, Shift+middle or right orbit; left button for the tool
- 4-44 imports (SECOND_KEYS from keymap at 35, for the help): the dialogs (sections, overrides, variables, keys, objects, openings, floors, presets, units, drawing, levels, wall types, materials, palette, projects), document helpers, i18n, carry geometryOf, object handles, section box, snap, controls, wallAt, opening-ui aim helpers, select gestures, room ring test, actions/openers, context entries, menu, registry (eachSolid, kindsNear), pick order, vector, outer sides, input-keys, input-buttons
- 45-51 PICK_PX 6 px; ACQUIRED snap kinds that a rest acquires; ACQUIRE_MS 450
- 53-83 wireInput: the openers the action list needs (dialogs, file picker); app.actionList and openCommands set (the action list is built afresh at each call); the app's dialog openers; the browser toggle
- 84-105 pan/press/right-press state; contextMenu(e): select tool, the element under the pointer becomes the selection (or none), refresh, contextPoint set only while the entries are built, the menu shown with the context table's labels and keys (F-0003)
- 106-135 shift; select gestures; the tracker (what is typed in the measure field, shown by the pointer); the marquee rectangle (crossing when dragged leftwards)
- 136-152 local (viewport px); snapAt for grips: walls of the level (but excluded), guides, parts; in 3D its metres-per-pixel taken at height 0, not the level's floor (F-0022)
- 153-171 guideTools (plan, wall/floor/measure, no drag); Alt state; worldAt: plan inverse transform, or the 3D ground point on the level's floor (with its lift) and its metres per pixel
- 172-192 aimAt3d: in 3D the surface seen under the pointer among the level's and the level below's walls, floors and openings, else worldAt
- 193-214 cached outer faces of the level's wall pieces (the tape snaps to faces) and of a level's walls (a wall drawn on a face snaps onto the faces of the level below)
- 215-245 last move, acquire timer, Tab point; elementPoints: openings' jambs and middles and objects'/columns' corners and centres on the level, cached per document and level
- 246-328 halfOf (half a wall's thickness: its snap reach); snapped(e): the aim point; from = the tape's/dimension's/grid's/guide's/beam's/roof's/stair's/railing's last point, or the Modify base, or the floor draft's last corner, or the wall chain's last point; faces when measuring; the level below's faces when drawing on a face; the lock dropped when the point it was set at is no longer the start; snap() with segments (faces, faces below, the level's walls with their reach, the level below's walls), from, the closing point (chain, floor, wall chain), orthogonal with Shift, the lock, acquired points, element and guide points, circles, parts, Tab skip, guides and grid axes
- 329-338 splitSnap: only a snap on a wall's body or middle
- 340-377 pickAt: plan → planPick, 3D → scene.pick; planHits: the visible kinds near the point (spatial index), drawn-last first; a grab handle first; then by pick order first / beforeWalls / walls / afterWalls / last, each nearest first
- 378-385 again (a second click on the selected element takes the next under it); boxDrag state
- 401-424 onMove continued: shift kept; a right button pressed during a left drag (a chord, reported as a move: buttons bitmask) ends what is under way; the pointer kept; a section box face dragged along its screen axis; the box's handle under the pointer lit in 3D; middle-button panning in plan
- 425-433 the cursor's world point; hover cleared outside select; a guide being set follows the pointer (Alt moved more than 4 px)
- 434-483 per tool: wall → snap and the wall tool's move (or render); the point tools → snap and render; object and Modify → snap and refresh (re-derived each move); split → its snap; corner → the wall under the pointer lit; floor → snap; room/floor → the enclosed room under the pointer lit, and the room tool's space; door/window → aim (in 3D on the wall under the ray, else the seen surface) and the opening tool's hover
- 484-504 an object handle dragged (refresh); select tool idle: the object handle under the pointer lit; a press in progress: the select gestures move and the marquee; else hover = what is under the pointer, render
- 506-542 onDown: shift, info cleared, focus; middle button in plan pans (capture); right press point; left: a section box handle drag, an object handle drag, or the select tool's press (capture, the hit, "again" for a second click on the one selected, gestures.down)
- 544-615 endWithRightClick: leaves Modify, cancels a guide, cancels a drag, ends a wall chain (as Enter), closes or drops a floor outline, steps back the dimension/grid/section/callout/beam-separator-curtain/mark tools, finishes a roof or railing, clears the tape; true when it ended something
- 617-643 onUp: a box drag kept as the view's; panning ends; a right click (not a right drag: 4 px) ends what is under way or opens the context menu; an object handle drag ends (endHandleDrag)
- 644-663 left release: moved more than 4 px; a guide placed; select: gestures.up, then a second click on the one selected takes the next element under the point (planHits round)
- 664-746 a click (not moved) per tool: opening place; Modify click at the snapped/aimed point; split at the snapped body point or the wall under the pointer; corner (plan wallAt, 3D scene pick); measure, dimension, grid, section, column, guide, object, beam, separator, mark (radius unsnapped), curtain, callout, calibrate: each with its snapped or aimed point, some plan-only
- 747-792 note/level mark at the snapped point; roof, stair, railing clicks; room: a touch's first tap shows the space, the second (inside it) makes the room; floor click (room or outline corner); else the wall tool's click at the snap
- 801-807 pointerleave also clears cursor and pointer and the opening aim, render; the browser's context menu suppressed on both canvases
- 808-823 3D double click opens/closes the selected doors and windows; the plan's wheel zooms at the pointer (exp(-deltaY·0.0015)), non-passive
- 825-832 wireButtons; the measure field's input refreshes the preview and the tracker; blur hides the tracker
- 833-879 the measure field's keys: Alt (in the guide tools) leaves the field for a guide; keys stop at the field; Tab adds "<" for an angle while drawing; Enter submits (success → field cleared and left) or, empty, does Enter's job (guide, wall chain, floor); Alt+digit for a guide typed by hand; Esc clears it, and when it was already empty cancels the guide, Modify step or wall step
- 881-895 keyup: Shift released drops a Shift lock (snap again at the last move); Alt released: kept from the browser outside fields; a guide set by Alt held and moved is placed where it was let go
- 898-967 wireKeys with the KeyContext (no palette member: Ctrl+K is the help.commands action): getters/setters over the closure's variables; lock(arrow): → x, ↑ y, ← along / ↓ square to the wall the snap names or the nearest straight wall (toast without one), the same arrow again releases it; shiftLock: Shift held on an angle/parallel/perpendicular snap locks that direction; nextSnap (Tab): the offered point skipped (grid/none/angle reset the skips) and snapped again
- 969-1001 renameInPlace: an input in place of the name button, Enter or blur keeps (once), Esc restores; keys stopped at the field, Enter/Esc prevented so they do not press the button again
- 1003-1066 showHelp: an action's row is its id: its name and current key (or "—"; redo and delete add their second key while they keep their own, SECOND_KEYS) come from the action list (F-0021: no key written here); the tools' own keys and gestures (guide, Enter, Tab, Esc, Backspace, Space, right click, drag alone, U, +/−, Shift+arrows, Shift, arrows, click again, wheel, middle, orbit) keep their text (the U row names Move's key as the user has it, app.keyName); the shortcuts dialog button; close by button, backdrop click or Esc; the list focused without scrolling
- 794-800 the canvases: focusable, pointermove/down/up listeners, pointerleave clears the hover
- 386-400 onMove start: last move kept; tracker; the acquire timer restarted (a rest of 450 ms on a point acquires it, three at most); Tab skips cleared once the pointer moves 4 px

## Contracts, state and data flow
- One closure holds the whole pointer state (pan, press, right press, Alt, Tab, acquire timer, caches, again, box drag) shared with input-keys through a KeyContext.

- Each tool's behaviour is spread across five places: onMove (434-483), onUp (664-791), endWithRightClick (549-615), input-keys.ts Escape (175-242) and Enter (243-263), plus chrome.ts's hint and keys and frame.ts's drafts: adding or changing a tool means editing every chain (the goal's root cause 3): F-0023.
- No pointercancel listener: the canvases have touch-action: none (styles.css:536), so touch panning does not cancel, but an app switch, palm rejection or too many pointers still can, leaving downAt/panning/drags set (F-0024).

## Depends on / used by
- uses: the imports at 4-43
- used by: app/main.ts (wireInput: to check), app/input-buttons.ts (renameInPlace, showHelp), app/input-keys.ts (showHelp)

## Problems found (finding IDs)
- F-0022 grip snaps in 3D measure their reach at height 0
- F-0023 each tool's behaviour spread over five if-chains in three files
- F-0024 no pointercancel handling
- F-0003 (the context menu, 98-104), F-0021 fixed (the help's rows read the action list, 1005-1039)

## To check in other files
- render/scene-3d.ts metresPerPixel(p, z), groundPoint, surfacePoint, pick
- tools/snap.ts input contract

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture : capture sends the pointer's later events to the element until pointerup or release
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events : a second button pressed while one is held is reported by pointermove (no pointerdown); buttons is a bitmask (left 1, right 2, middle 4) (line 405)
- https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event : pointercancel replaces pointerup when the browser takes the pointer (touch pan/zoom, app switch, palm rejection); cleanup must run on either (to check: no pointercancel listener seen so far)
- https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action : touch-action: none keeps the browser from taking the gesture (so no pointercancel for panning/zooming); other interruptions can still cancel
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus : focus({ preventScroll: true }) focuses without scrolling (line 1090)
- https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect : viewport-relative rectangle, same space as clientX/Y (lines 117, 137, 165)
