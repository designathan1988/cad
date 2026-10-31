# tests/app/marquee.test.ts
Lines: 35
Summary: Tests of window and crossing selection over screen outlines: a window around three windows takes only them; a crossing touching the middle window and the wall takes both; a crossing inside an L room's notch takes nothing; a crossing wholly inside the room takes it.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: window and crossing selection over outlines
- 3-5 imports: vitest, marqueePick, vec
- 7 rect helper (four corners)
- 9-16 items: a 600×20 px wall, three windows in it, an L-shaped room below
- 18-34 the four cases (window left-to-right; crossing right-to-left; notch; wholly inside)

## Contracts, state and data flow
- Pure: a window takes wholly-inside outlines; a crossing takes outlines touched or containing the box.

## Depends on / used by
- uses: src/app/select-drag (marqueePick), src/core/vector
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Point_in_polygon : the even-odd crossing test decides inside for non-convex outlines (the notch and inside cases, lines 27-33)
