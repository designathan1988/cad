# tests/elements/opening/derive.test.ts
Lines: 156
Summary: Tests of rule → position, worked by hand on a 5 m × 2.8 m wall:
- defaults: a door is 0.90 × 2.10 on the floor; a window is 1.20 × 1.20 on a 1.00 sill;
- rules: fromStart, fromEnd, centred, and fromOpening toward the end or the start;
- a chain of references resolves in any list order;
- on a 6 m wall: fromStart stays put, fromEnd follows the end, centred follows the middle;
- valid cases: openings touching jamb to jamb; a door at distance 0;
- invalid but still placed, with a warning:
  - past the end, before the start, or wider than the wall;
  - an overlapping pair, warned once (openings on different walls never overlap);
  - a window taller than the wall (a 2.10 door in 2.10 is fine);
  - a missing host;
  - a missing, other-wall or looping reference: centred.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: stations from the start along the reference line, jamb to jamb
- 4-6 imports: vitest, deriveOpenings/HostInfo, newOpening/OPENING_DEFAULTS/Opening/PositionRule
- 8-15 helpers: a hosts Map with one wall, door/win builders, `at` (start, end, valid, warnings)
- 17-26 OPENING_DEFAULTS for door and window, and newOpening using them
- 28-34 fromStart 0.5 → [0.5, 1.4], valid
- 36-46 fromEnd 0.5 → [3.6, 4.5]; centred → [2.05, 2.95]
- 48-61 fromOpening toward the end → [2.0, 3.2]; toward the start → [2.4, 3.3]
- 63-72 a three-opening chain listed in reverse: c → [2.3, 3.2]
- 74-84 a 6 m wall: 0.5, 4.6, 2.4
- 86-95 touching jambs are both valid; distance 0 is valid; suite closes
- 97-106 past the end: placed at [4.5, 5.4], invalid, warned per opening and in the document's list
- 108-116 a negative distance; a 0.40 m wall with the door centred at −0.25
- 118-130 an overlapping pair warned once as a pair; openings on two walls give no warning
- 132-136 openingTooTall at a 2 m height; doors at 2.8 and at exactly 2.1 are valid
- 138-142 a host that does not exist: invalid with openingNoHost
- 144-155 bad references (missing, other wall, loop): openingBadReference, centred at 2.05; suite closes (line 156 blank)

## Contracts, state and data flow
- deriveOpenings is pure. It returns positions plus warnings per opening and for the whole document.
- The fallback for a bad reference is "centred", which is the jump F-0068 describes. The fromOpening cases are the design that RC2 replaces with explicit stations.

## Depends on / used by
- uses: src/elements/opening/derive, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (fromOpening and the centred fallback: F-0068)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/Map : new Map takes an iterable of [key, value] pairs (lines 8, 127, 145)
