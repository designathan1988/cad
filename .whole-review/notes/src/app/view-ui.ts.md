# src/app/view-ui.ts
Lines: 325
Summary: The views over the App: the section box (on/off, handles, drag direction, set), explode, the 3D view's options, plan/3D switch and first framing, keeping the plan's zoom, sliding the plan or 3D view so the selection is not under a panel, what the panels cover, frame all/selection, the four elevations, a vertical section at a guide, and the view keys.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: plan/3D, framing, keys, elevations, sections, box, explode; app.ts delegates
- 3-18 imports: three, Point2, Insets, t, ViewId, hasSolid, levelOf, boundsOf, savePrefs, keep-in-view, ViewKey, section-box, BOX_HANDLE_HIT, view-3d, ROTATE_OFFSET, App
- 20-28 toggleBox: off, or on around the shown geometry from the lowest level's floor to the highest level's top (Math.min/max over levels: Infinity with no levels)
- 30-48 boxHandleAt: the nearest face handle within BOX_HANDLE_HIT px (client coordinates)
- 50-59 boxFaceOnScreen: px a face's handle moves per metre outward
- 61-66 setBox: drawn now, saved at the drag's end
- 68-77 toggleExplode: with fewer than two levels shown, a hint instead
- 79-93 setView3D: to 3D; patched; info cleared; saved; elements no longer shown leave the selection; refresh
- 95-103 setView: unchanged → nothing; guide being placed dropped; saved; first framing
- 105-114 frameFirst: the plan as left before a reload, else frame all
- 116-125 keepPlanView: the plan's zoom/centre saved 400 ms after it stops changing
- 127-141 keepSelectionInView: runs again only when the selection, its extent, what is covered or the window size changed
- 142-156 a new selection moves the plan only from under what covers it (or after a resize/reshape); never during a drag
- 157-175 onScreen: the selection's box, its turn handle and (under a phone's sheet) its temporary dimensions with their text
- 176-184 a selection larger than the window is left alone (the comment still speaks of "the terrain" and "the whole lot": areas taken out, F-0041)
- 185-189 fitFactor < 1 → zoom out about the selection's middle. A free part of zero or negative size gives k = 0 or k < 0 (F-0025), and zoomAt(…, 0 or negative) collapses or flips the plan; NaN skips
- 190-194 the smallest pan into the free part
- 196-222 keepSelectionInView3d: the selection's box between the level's (or NO_LEVEL's, imported at 9: F-0139) floor and top (with its lift) projected; panned on screen when covered
- 224-235 covered: the browser drawer on the left; the panel as a bottom sheet or a right drawer (hidden → zero rect)
- 237-246 frameAll: the shown geometry framed in the view (none when the viewport has no size)
- 248-261 elevation: 3D, parallel, framed from a side (north = −z in three.js = +y in plan)
- 263-291 sectionAtGuide: the selected line guide; the kept side the one with more wall midpoints (or flipped); section on, parallel, framed from the cut side; toast naming the commands key as the user has it
- 293-296 clearSection: the section off
- 298-306 frameSelection: the selection's box, or all when it has none
- 308-324 keyView: plan zoom about the free part's middle or pan by pixels; 3D zoom or orbit (80 px ≈ 10°)

## Contracts, state and data flow
- F-0025's effect path is here (185-187).
- Elements hidden by the 3D level filter leave the selection (89-91), consistent with hidden categories.

## Depends on / used by
- uses: app/keep-in-view.ts, app/section-box.ts, app/view-3d.ts, app/geometry.ts, app/persist.ts, render/overlay-3d.ts, render/plan-view.ts (Insets), three
- used by: app/app.ts (delegates), app/actions.ts, app/input.ts, app/input-buttons.ts, app/frame.ts

## Problems found (finding IDs)
- F-0025 (effect confirmed: 185-187)
- F-0041 comments naming the terrain and the lot (taken out)

## To check in other files
- render/plan-view.ts zoomAt: what a factor ≤ 0 does

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout : an invalid or undefined id does nothing (line 123)
- https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect : viewport-relative; zero size for elements with no box (lines 34, 133, 226-233)
