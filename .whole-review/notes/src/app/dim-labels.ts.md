# src/app/dim-labels.ts
Lines: 39
Summary: Pure placement of temporary dimension value labels on screen: each at its line's middle, or slid along its line in 4 px steps, or stepped off it vertically, until clear of the labels placed before it.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: middle of the line, slid along it in small steps, or beside the others when the line is too short
- 6 import of the Point2 type (core/vector.ts)
- 8-14 DimLabel: line ends a, b (screen px) and the label's size
- 16 STEP: 4 px between candidate positions along the line
- 18-38 separateLabels: placed boxes; clear = no overlap with any placed box (centre distance ≥ half the sizes on x or on y); per label: middle; if not clear, candidates alternating +s/−s along its unit direction up to half the line, then ±k label heights straight up/down (k ≤ count + 1); the first clear one, else the middle; returns the centres in input order

## Contracts, state and data flow
- Order matters: earlier labels keep their middle, later ones move. Zero-length line: direction (1, 0), only the off-line candidates.

## Depends on / used by
- uses: core/vector.ts (type)
- used by: render/plan-view.ts (dimension value boxes: to check), tests/app/dim-labels.test.ts

## Problems found (finding IDs)
- none

## To check in other files
- render/plan-view.ts dimValueBoxes: same placement used for the handles' avoidance (app.ts:1594)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find : first match or undefined (line 33 falls back with ??)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot : the line's length; 0 for a zero-length line (line 24-25)
