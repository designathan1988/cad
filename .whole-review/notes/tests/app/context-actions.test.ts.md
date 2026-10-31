# tests/app/context-actions.test.ts
Lines: 84
Summary: Tests of the context actions (right-click menu and floating bar) per selection: a wall, a door, a window, a room with and without a floor, an outline floor, several, nothing, never more than six; and the guides' entries.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: 4 to 6 actions that fit the kind
- 4-7 imports: vitest, contextIds, document, newOpening
- 9-18 wall helper: a concrete 20 centreline wall on the ground
- 20-30 two walls, a door and two windows, a room, an outline floor
- 32-53 per kind: wall; door (name out of date: F-0135); window (name out of date: F-0135); room with/without floor; outline floor
- 55-59 several: distribute for openings of one wall, else frame/clear/delete
- 61-68 nothing selected; at most six; the suite closes
- 70-83 guides: clear guides offered when the level has some; a selected guide's actions

## Contracts, state and data flow
- Pure: action ids per selection; RC1 (F-0003) concerns the menu's own key table, not these ids.

## Depends on / used by
- uses: src/app/context-actions, src/app/document, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0135 (S4): test names out of date

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobelessthanorequal : asserts the value is at most the given number (line 66)
