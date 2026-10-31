# tests/tools/opening-tool.test.ts
Lines: 128
Summary: Tests of the opening tool's state table and of the rule it picks under the cursor, on a 5 m wall with a 0.90 door at 1 cm per pixel (the centre snaps within 10 px). Rules picked:
- near the start: the near jamb's distance from the start, in 5 cm steps;
- near the end: the far jamb's distance from the end;
- within 10 px of the middle: centred;
- nearest another opening: the gap from its jamb (fromOpening), which creates a link the user does not see (F-0068 Also);
- a reference the door would overlap loses to one it clears.
Table:
- hover aims, leaving the walls goes idle, and a click places the door with the rule and the cursor's side while the tool stays;
- clicking or typing while idle is refused, and so is a negative distance;
- a typed distance keeps the same reference, or, while centred, takes the nearer end;
- Esc goes idle.
Walls meeting this one (stops): positions are measured from a partition's face on either side, and a typed distance is the gap to that face.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the table, the rule under the cursor, the 10 px centre snap
- 4-5 imports: vitest, Aim, OPENING_IDLE, openingTransition, ruleAt
- 7-14 aim() builder (wall w, 5 m, station, side, other openings, mpp 0.01)
- 16-31 fromStart 0.55 near the start; fromEnd 0.55 near the end; centred at 2.52 and 2.41, not at 2.35
- 33-41 other [1.0, 1.9] at 2.75 → fromOpening 0.40 toward the end; other [3.5, 4.4] at 1.0 → fromStart 0.55; at 2.9 → fromOpening 0.15 toward the start; suite closes
- 43-49 an overlapping reference loses: fromEnd 0.55
- 51-62 hover → aiming with its rule; hover off → idle
- 64-75 click places {wallId, rule, swing 'right'} and stays aiming; idle click rejected
- 77-89 typed 1.2 keeps fromEnd; typed 0.3 keeps fromOpening x; centred typed 1 → fromStart at 2.45, fromEnd at 2.55
- 91-101 typed while idle or −1 rejected; Esc → idle; suite closes
- 103-113 stops at 2.93/3.08: centre 2.21 → fromEnd measured from the face, 0.25 gap
- 115-121 centre 3.6 → fromStart 3.08 + 0.05
- 122-127 typed 0.4 past the partition → fromStart 3.48; suite closes (line 128 blank)

## Contracts, state and data flow
- Pure transitions: the tool computes a rule from the aim (station, stops, other openings) and hands a place request to the app. The fromOpening choice is where the hidden links of root cause 2 are born (F-0068 Also, opening-tool.ts ruleAt).

## Depends on / used by
- uses: src/tools/opening-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0068 (Also: lines 33-40 and 80-81 pin the silent fromOpening link)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#expect-closeto : expect.closeTo inside toEqual objects (lines 19-47, 55, 67)
