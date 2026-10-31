# tests/elements/opening/commands.test.ts
Lines: 106
Summary: Tests of opening commands on a 5 m wall with a door, a window measured from that door (fromOpening), and a door measured from the end, plus a window centred on a 3 m wall:
- add and edit are one undo step each; an edit that changes nothing, or names an unknown id, makes no step;
- hostsOf gives each wall's length, its height from the level, and its line;
- deleting a wall deletes the openings it hosts in one step, and undo restores both;
- deleting the referenced door turns the window's rule into fromStart 2.0 at the same place;
- ruleKeepingPosition converts between rule kinds without moving the opening;
- ruleKeepingPosition refuses a reference on another wall, the opening itself, a loop, or a missing reference id.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: one undo step each, cascades, rule changes that keep the place
- 3-9 imports: vitest, document, store, the opening commands (add, delete, ruleKeepingPosition, update), derive, newOpening, addWalls
- 11-20 wall helper along the x axis
- 22-31 setup: walls w (5 m) and v (3 m); a door from the start; window b fromOpening a, 0.6 toward the end; window c centred on v; door d fromEnd 0.5
- 33-36 position helper: [start, end] from deriveOpenings
- 38-49 four openings; widening a is undone back to 0.9; undoing again removes d (the last add)
- 51-57 a no-op width and an unknown id leave the same document (identity)
- 59-63 hosts: length, height 2.8, line
- 65-73 deleting v removes c; one undo restores both
- 75-85 deleting a: b becomes fromStart 2 and stays at [2.0, 3.2]
- 87-95 ruleKeepingPosition: fromEnd 3.6, fromStart 2 and 3.6, fromOpening b 0.4 toward the end, fromOpening d 2.2 toward the start
- 97-105 null for another wall's opening, itself, a loop (b measures from a), or no id; suite closes (line 106 blank)

## Contracts, state and data flow
- Commands are pure. A no-op returns the same doc, so the store records no step. fromOpening is the rule RC2 removes (F-0068); this file asserts the conversions the migration will need (ruleKeepingPosition to fromStart).

## Depends on / used by
- uses: src/app/document, src/core/store, src/elements/opening (commands, derive, schema), src/elements/wall/commands
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (fromOpening as a stored rule: F-0068)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tohavelength : asserts an object's length property (lines 42, 48, 71-72)
