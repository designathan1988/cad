# src/app/view-3d.ts
Lines: 97
Summary: The 3D view's interface state (kept in preferences, not the document): which levels show, explode, cut, x-ray, section box, orthographic, section line, visual style, quality, brightness and sun; the levels shown, whether exploding, a level's lift, the cut height, and reading a stored value with defaults.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: Revit/ArchiCAD-like level filters, explode, cut at the plan's cut height, x-ray; interface state outside the document and its undo
- 7-8 imports: cutHeightOf/Level, section-box readers and types
- 10 LevelsShown: all, below (current and lower), current
- 12-18 VISUAL_STYLES (hidden, shaded, consistent, realistic, photo) and RENDER_QUALITIES (low…ultra) as const tuples with their unions
- 20-36 View3D: the fields listed in the summary
- 38-39 LIGHT_RANGE 0.25..3
- 41 VIEW_3D_DEFAULT: all levels, nothing on, shaded, medium, light 1
- 43-44 EXPLODE_GAP 2.5 m
- 46 byElevation: a sorted copy
- 48-54 shownLevels: all (or when the current is unknown), current only, or those at or below its elevation
- 56-61 exploding: asked and two or more levels shown
- 63-68 liftOf: the level's index by elevation × 2.5 m when exploding, else 0
- 70-75 cutAt: the current level's elevation + cut height + its lift; null when not cutting
- 77-78 lightOf: a finite number within the range, else 1
- 80-96 readView3D: each field validated with its default (box and section by their readers)

## Contracts, state and data flow
- The scene lifts each level by liftOf when exploding; code comparing scene heights with document heights must add the lift (opening-ui.ts wallUnderRay does not: F-0040).

## Depends on / used by
- uses: app/document.ts (cutHeightOf, Level), app/section-box.ts
- used by: app/app.ts (lift, readView3D), app/chrome.ts, app/frame.ts, app/view-ui.ts, app/views-ui.ts, app/actions.ts, app/persist.ts (type), render/scene-3d.ts

## Problems found (finding IDs)
- F-0040 (seen through opening-ui.ts: placing a door or window on a lifted level in an exploded 3D view)

## To check in other files
- render/scene-3d.ts rayAt: whether the ray is in lifted scene coordinates

## Sources
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html : as const makes a readonly tuple of literal types; (typeof X)[number] the union (lines 14-18)
