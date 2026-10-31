# tests/tools/measure-chain.test.ts
Lines: 64
Summary: Tests of chain measuring (phase 9) through the measure tool's state machine.
- Clicks add stretches; the same point twice adds nothing.
- Clicking the first point again with three or more corners closes the chain and gives its area and perimeter. With two corners it does not close.
- Enter ends the chain open when it has two or more points, and waits with one. Esc drops it. A click after a finished chain starts a new one.
- The area is the same whichever way round; an L shape is measured correctly. Self-crossing chains are not tested (F-0103).
- The angle between two stretches lies between 0° and 180°, or is null when a stretch has no length.
- The two-point measure: the test is named "a third click starts again", but it only checks that Enter keeps the finished measure (F-0135 Also).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: chain stretches, last angle, area and perimeter when closed; Enter and Esc
- 4-8 imports (vitest, measure-tool functions and states); p(); click() through measureTransition in chain mode
- 10-19 points (0, 0), (4, 0), (4, 0) again, (4, 3): three points, length 7
- 21-33 closing on the first point: chainDone closed; area 6, perimeter 12; two corners back on the first stays a chain
- 35-43 Enter with one point: the same state; with two: chainDone open; Esc: idle; a click after done starts [(9, 9)]
- 45-49 an L of area 6 in both orders
- 51-56 angleAt 90, 180, 45; a zero stretch gives null
- 58-63 the two-point mode: two clicks give 'done'; Enter keeps it (the name says "a third click"); suite closes (line 64 blank)

## Contracts, state and data flow
- measureTransition is a pure transition function from (state, event, mode) to the next state. It returns the same object when nothing changes, so the tests use toBe for "no change".

## Depends on / used by
- uses: src/tools/measure-tool
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0135 (Also: line 58's name); F-0103 (self-crossing chains, not tested here)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Finite-state_machine : a transition function maps the current state and an input to the next state (measureTransition, lines 8-63)
- https://en.wikipedia.org/wiki/Shoelace_formula : signed polygon area; its absolute value is the same either way round (lines 45-49)
