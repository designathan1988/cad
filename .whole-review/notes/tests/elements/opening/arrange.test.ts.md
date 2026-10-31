# tests/elements/opening/arrange.test.ts
Lines: 242
Summary: Tests of openings positioned from other openings, worked by hand. Positions are stations along the host's reference line, jamb to jamb.
- Aligned openings: centred across a parallel wall or one drawn the other way, or lined up by edge. An aligned opening follows its reference when the reference moves. A missing reference, a loop or a curved host centres it with a warning. The align command skips openings on the reference's own wall and refuses loops. Deleting the reference keeps the aligned opening where it was.
- Distributed groups: equal spaces, which follow the wall's length, or a fixed gap measured from the centre, the start or the end. A group needs two or more openings on one wall. Ungrouping keeps positions. A member given another rule dissolves the group and the others stay put. A group left with one member dissolves. Deleting the wall deletes its groups. Each command is one undo step. A member whose group is gone is centred with a warning.
- Align heads: windows take the reference's top; a door keeps its 0 sill and changes height; a raised wall gets a lower sill.
- placementProblem: reports an overlap or an opening that does not fit.
- Align candidates: only openings whose projection falls on the wall are offered.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: positions are stations from the host's start, jamb to jamb
- 4-20 imports: vitest, document, store, the opening commands (align, distribute, group, update, delete, candidates), derive, newOpening/PositionRule
- 22-41 helpers: wall, win/door, docOf, placed (deriveOpenings), startOf, near (9 digits)
- 43-48 walls w, v (parallel 3 m away) and r (v reversed); reference window a from 1.00 to 2.20
- 50-55 a door aligned at the centre across: start 1.15, valid
- 57-60 on the reversed wall: centre 4.40, start 3.95
- 62-68 aligned by edge on r: start jamb 3.80; end jamb 5 − 0.9
- 70-74 moving a to 2.00 moves b to 2.15 (RC2 pinned: F-0068)
- 76-88 missing, looping or curved-host references are centred and warned
- 90-97 alignOpenings sets the aligned rule, skips the same-wall opening, refuses a loop (returns the same doc)
- 99-106 deleting the reference turns b into fromStart 1.15; the aligned suite closes
- 108-121 three windows given equal spaces of 0.60, ordered along the wall, all valid
- 123-128 on an 8 m wall the spaces become 1.10 (derived from the wall)
- 130-140 fixed gap 0.5: the row centred, or from the start at 0.2, or from the end at 0.3
- 142-146 fewer than two openings, or openings on different walls: no change
- 148-154 ungroup: every member keeps its station as fromStart
- 156-165 a member given another rule dissolves the group; the others stay (the user's report)
- 167-174 a group left with one member: that member becomes fromStart where it was
- 176-181 deleting the wall removes its openings and groups
- 183-191 distribute, then set spacing: two undo steps
- 193-198 inGroup pointing at a missing group: centred at 2.4 with a warning; suite closes
- 200-217 alignHeads: window sill 1.6; door sill 0, height 2.2; raised wall sill 0.7
- 219-226 placementProblem: openingOverlap, openingOutside, null
- 228-241 a wall beyond w's end: its door is not offered as a candidate, align refuses it, and ruleKeepingPosition gives null; suite closes (line 242 blank)

## Contracts, state and data flow
- Positions are derived from rules on every read (deriveOpenings). Links to other openings (aligned, inGroup) move dependents when the reference or the wall changes. These are the expectations the RC2 fix must rewrite (F-0068 Also).

## Depends on / used by
- uses: src/app/document, src/core/store, src/elements/opening (commands, derive, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0068 (Also: this file pins the derived positions)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tocontain : toContain asserts that an item is in the array (warnings lines 79-87, 196; candidates 236-237)
