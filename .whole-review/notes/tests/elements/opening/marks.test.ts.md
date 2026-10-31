# tests/elements/opening/marks.test.ts
Lines: 40
Summary: Tests of door and window type marks.
- Doors of one size share a mark. Sizes are numbered from the smallest, by width then height (P1…). Windows are numbered apart (J1…), and a different sill makes a different type.
- The marks do not depend on the order the openings were drawn in.
- markPoint puts a door's tag on the side its leaf does not open to. A window's tag goes outside, unless that side is a room.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: a type is a size, numbered from the smallest (the code keys by the whole style too: F-0071)
- 3-6 imports: vitest, markPoint/openingMarks, OpeningFrame, newOpening
- 8-10 door and window builders (a module const `window` again), prefixes P and J
- 12-16 five doors: 0.8 → P1; the 0.9 × 2.1 pair → P2; 0.9 × 2.2 → P3; 1.2 → P4 (Map → object via Object.fromEntries)
- 18-21 windows numbered apart from doors; sill 1.1 makes J3
- 23-26 the same marks for the reversed list
- 28-39 tag positions on a 15 cm wall along x: swing left → below (−0.325); swing right → above; window → exterior side (below); with a room below, the window's tag goes up; suite closes (line 39; 40 blank)

## Contracts, state and data flow
- openingMarks returns a Map of id → mark, ordered by size.
- All the test openings use the default style, so the style part of the type key (F-0071) is not exercised.

## Depends on / used by
- uses: src/elements/opening (marks, void, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0071: header says "a type is a size")

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries : accepts any iterable of [key, value], a Map included (lines 15, 20)
