# tests/elements/level/commands.test.ts
Lines: 88
Summary: Tests of level commands. A new level goes on top of the highest one, with the same height and cut height. Renaming a level or changing its elevation or height moves the walls on it, because their heights are derived. A zero height or a blank name is refused with no undo step. The cut height defaults to 1.20, can be changed, and 0 or less is refused. Deleting is refused for the last level and for a level with walls, and can be undone. levelOverlaps reports a level that reaches above the next one's bottom. deleteBlocker says why a level cannot be deleted.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 imports: vitest, the document helpers (cutHeightOf, wallHeights), createStore, vec, and the level commands
- 7-16 wall helper: a 4 m masonry wall whose top is set by its level, on the given level
- 18-27 addLevel puts the new level at elevation 2.8 with height 2.8; after a height of 3, the next one goes at 5.8
- 29-35 updateLevel renames the level and sets elevation 0.5 and height 3; the wall then runs from 0.5 to 3.5
- 37-42 height 0 and a blank name are refused: canUndo stays false
- 44-55 cut height: default 1.2; 0 and −1 refused; 1.5 accepted; a new level inherits it
- 57-69 deleteLevel: refused for the last level and for the level with the wall; the empty level is deleted and the delete is undone; suite closes
- 71-78 levelOverlaps: none at first; with ground height 3, ground reaches 0.2 into Upper (checked with expect.closeTo at 12 digits)
- 80-87 deleteBlocker: 'last', 'walls', or null; suite closes (line 88 blank)

## Contracts, state and data flow
- Commands go through the store. A refused change returns the same document, so no undo step is recorded.
- The test pins deletion as refused only for "walls on it". Every other element on a deleted level is left orphaned, and no test covers that (F-0057).

## Depends on / used by
- uses: src/app/document, src/core/store, src/core/vector, src/elements/level/commands
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (pins F-0057's walls-only blocker)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#expect-closeto : expect.closeTo is an asymmetric matcher; inside toEqual it accepts a value within the given precision (line 77)
