# src/ui/bar-place.ts
Lines: 41
Summary: The vertical position of the floating action bar: above the selection, pushed up past boxes in its own columns; else below, pushed down; else the nearest free place inside the view searched outward in 4 px steps. Pure.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: above, then below, then the nearest free place; boxes outside the bar's columns never move it
- 6-11 Span: a screen box (left, right, top, bottom)
- 13-15 gaps: 10 px from the selection, 8 px from a box, 8 px from the view's edge
- 17-22 placeBarY signature: the bar (left, width, height), the selection's top and bottom, the boxes, the view height
- 23-24 the boxes overlapping the bar's columns, and the one the bar would cover at y
- 25-27 above the selection, moved up past each covered box (at most one pass per box); returned when inside the top edge
- 28-31 below the selection, moved down past boxes, clamped to the bottom edge; returned when free
- 32-38 outward search for a free spot inside the view; else the clamped place
- 40 STEP 4 px (declared after the function; safe, read only when called)

## Contracts, state and data flow
- Pure; pixel values in the view's coordinates. The loop bounds (n < boxes.length) stop a cycle.

## Depends on / used by
- uses: nothing
- used by: app/chrome.ts (the floating bar's placement)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let : the temporal dead zone depends on execution order, so STEP (line 40) read inside placeBarY when called later is initialised (lines 34, 40)
