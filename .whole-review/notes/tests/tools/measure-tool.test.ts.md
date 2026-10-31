# tests/tools/measure-tool.test.ts
Lines: 34
Summary: Tests of the measure tool's two-point state table, row by row, and of what a tape reads.
- Idle, then click: the tape starts there.
- From a, then click: the measurement a–b stays.
- Done, then click: a new tape starts.
- Esc drops the tape or clears the measurement.
- A 3-4-5 tape reads 5 m long, 3 along x and 4 along y, at 53.13°. Read backwards, its angle is 233.13°, which means the angle runs over 0–360°.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the table row by row and the tape's reading
- 3-6 imports (vitest, MEASURE_IDLE, measureTransition, reading) and p()
- 8-11 idle + click → from a
- 13-15 from + click → done a–b
- 17-19 done + click → from the new point
- 21-24 Esc from 'from' and from 'done' → idle
- 26-33 reading(1,2 → 4,6): length 5, dx 3, dy 4, angle 53.130102354°; reversed 233.130102354°; suite closes (line 34 blank)

## Contracts, state and data flow
- Pure transitions in the default (two-point) mode. reading() gives the length, the components and a 0–360° angle (atan2 mapped into that range).

## Depends on / used by
- uses: src/tools/measure-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/atan2 : atan2 is in (−π, π]; mapping to 0–360° by modulo (lines 30-31)
