# src/app/object-handles.ts
Lines: 269
Summary: Drag handles of one selected parametric object (its definition's hotspots) and of one selected door or window (jambs → width, head → height, a window's sill), in plan and 3D: where they are on screen and their axis; picking one; the drag (pointer motion along the screen axis, divided by how fast the handle moves with its value, so it stays under the pointer); one undo step on release; and drawing them.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: GDL-like hotspots; door/window handles; the motion along the screen axis changes the parameter; the opposite face stays; height handles hidden in plan (end-on). Line 3 is a broken line ("alike: each" alone)
- 9-16 imports: Point2, setObjectValues, updateOpening, Opening/PositionRule, evaluateObject/held, deriveGeometry, ObjectSolid, App type
- 18-31 ScreenHandle: id, param, screen point, screen axis (px per metre), shift, plan axis, opening handle kind or object handle index
- 33-34 OpeningHandle: start, end, head, sill
- 36-37 reach: 22 px when the PRIMARY pointer is coarse, else 10 px (a touch on a laptop whose primary pointer is a mouse gets 10 px: F-0031)
- 39-58 objectHandles: select tool, one selected, no drag; an opening → openingHandles; an object on the level shown: each evaluated handle projected (plan or 3D at floor + lift + z), its axis on screen; end-on (< 4 px) not shown
- 60-91 openingHandles: on the wall's mid-thickness; jambs along the wall (start backwards, end forwards) at half height; head up at the top; a window's sill down at the bottom
- 93-105 ruleFor: when one jamb moves by grow, a fromStart/fromEnd/fromOpening distance measured from that side gives way; other rules (centred, aligned, inGroup) kept
- 107-119 objectHandleAt: the nearest handle within reach
- 121-142 HandleDrag: the handle, start point, start value and place, value and place so far, an opening's patch and base, the most height (to the wall's top), the rate
- 144-148 PROBE 1 cm; usable(rate): finite and over 0.05, else 1
- 150-164 objectRate: the definition evaluated a step on (down at the maximum), the handle found again by index, its motion along its axis per unit, plus the object's shift
- 166-178 jambRate: the whole document derived again with the opening 1 cm wider (deriveGeometry of everything, once per drag start), the jamb's outward motion per unit
- 180-195 startHandleDrag: an opening's start value (height, sill or width), its rate, its most; an object's parameter value and rate
- 197-219 moveHandleDrag for openings: delta along the screen axis / rate; centimetre snap with snaps on; head 0.2..most; sill 0..(head − 0.2) keeping the head; width ≥ 0.2 with the rule adjusted (no maximum: a width past the wall is left to the derivation's warnings)
- 220-230 moveHandleDrag for objects: delta / rate; 5 mm snap; held to the parameter's range; the position moved by the shift along the plan axis
- 232-240 endHandleDrag: unchanged → nothing; an opening → updateOpening(patch); an object → setObjectValues with value and position
- 242-268 drawObjectHandles: a 6 px disc (filled when hot) and an arrowhead outward along the axis; beginPath before each arc so no connecting line

## Contracts, state and data flow
- The preview is in the geometry (the drag's patch applied elsewhere: frame/app); the store gets one command on release.
- An opening dragged by a jamb rewrites its position rule distance: the rule system of root cause 2 is touched here too (ruleFor keeps fromOpening links).

## Depends on / used by
- uses: elements/object/evaluate.ts, elements/object/commands.ts, elements/opening/commands.ts, app/geometry.ts, app/app.ts (plan, projectAt, lift)
- used by: app/input.ts (pick, start, move, end), app/frame.ts (draw, preview), app/handles.ts (to check)

## Problems found (finding IDs)
- F-0031 touch target size from the primary pointer only

## To check in other files
- where the drag's patch is shown as preview (frame.ts / app.ts visibleGeometry)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer : pointer tests the primary device only; any-pointer tests all (line 37)
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/arc : arc adds to the current subpath (a line from the last point unless beginPath first) (lines 254-255)
