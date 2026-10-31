# src/tools/dimension-tool.ts
Lines: 38
Summary: The linear dimension tool as a pure state machine: first end, second end (not within 0.1 mm of the first), then a third click that places the dimension line and makes the dimension; Escape steps back one state or leaves.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-11 header and the transition table (idle → from → placing → idle; escape steps back)
- 13 import: distance and Point2
- 15-18 DimensionToolState: idle, from a, placing a–b
- 20 DimensionToolEvent: click with a point, or escape
- 22 DIMENSION_IDLE: the idle state
- 24-25 TOO_SHORT 1e-4 m
- 27-37 dimensionTransition: escape from placing goes back to from a, else idle; click from idle starts, from 'from' takes the second end unless too short, from placing makes {a, b, through}

## Contracts, state and data flow
- Pure; narrowed by the `kind` discriminant. The anchors (what the points were put on) are attached by the caller (app.ts / kind-tools.ts), not here.

## Depends on / used by
- uses: core/vector (distance)
- used by: app/app.ts, app/kind-tools.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html : discriminated unions narrow on the literal kind, and early returns leave the remaining member (line 36 is the placing state) (lines 15-37)
