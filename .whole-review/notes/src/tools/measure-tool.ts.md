# src/tools/measure-tool.ts
Lines: 81
Summary: The measure tool (a tape) as a pure state machine with two modes: distance (two clicks → length, runs along x and y, angle) and chain (each click adds a stretch; Enter ends it open, a click on its first point closes it and reads area and perimeter). Plus the pure readings: chain length, chain area, angle between stretches, a tape's reading.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-15 header and the transition table (idle/from/done; chain described in prose)
- 17 import: distance and Point2
- 19-24 MeasureState: idle, from, done, chain (points), chainDone (points, closed)
- 26-30 MeasureEvent (click, enter, escape), MeasureMode, MEASURE_IDLE
- 32-45 measureTransition: escape → idle; enter ends a chain of 2+ points open; chain mode: a new chain unless in one, closed when the click is (within 1e-9) on the first point with 3+ points, a repeated point ignored, else appended; distance mode: from → done, else from
- 47-51 chainLength: sum of stretches, plus the closing one when closed with 3+ points
- 53-62 chainArea: absolute shoelace sum / 2 (F-0103 for crossing chains)
- 64-72 angleAt: angle at b between the stretches (0–180°), null when one is under 1e-9; acos argument clamped
- 74-80 reading: length, dx, dy, angle from +x in 0–360°

## Contracts, state and data flow
- Pure; closing relies on the snap giving exactly the first point (input.ts:304-307 offers chainStart as a snap target).

## Depends on / used by
- uses: core/vector (distance)
- used by: app/app.ts (measureEvent 1015-1019), app/chrome.ts (hints 420-428), app/frame.ts (tape, chain line and area label 89-138, 292-298), app/input.ts (chainStart snap)

## Problems found (finding IDs)
- F-0103 (S4): a self-crossing closed chain reads a net area

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Shoelace_formula : the area of a simple polygon from its vertices; for self-overlapping ones the formula gives the signed sum of the lobes (lines 53-62)
