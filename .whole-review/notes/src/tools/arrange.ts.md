# src/tools/arrange.ts
Lines: 66
Summary: Align and distribute any selection by the plan boxes around its elements: align to the selection box's left, centre, right, bottom, middle or top; distribute along x or y with equal gaps, the first and last (by centre) staying. Returns only the step each box takes; the app moves each element. Also the box helper used by select-drag.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: align to the selection's box, distribute with equal gaps; only steps, the app moves
- 6 import: Point2 type
- 8-9 ArrangeHow and ARRANGE_HOWS: the eight ways
- 11-14 Box: min and max points
- 16-22 boxOf: min/max of all points by spreading arrays into Math.min/Math.max (F-0100)
- 24-25 arrangeNeeds: 3 to distribute, 2 to align
- 27-32 arrangeSteps setup: zero steps when too few; the box of all boxes (spread again); mid of a box per axis
- 33-45 the six alignments: each box's difference to the overall box's side or middle on one axis
- 46-63 spreadX/spreadY: indices sorted by centre; total size; gap = (last.max − first.min − sizes)/(n − 1), negative when they overlap; each box placed at a running position
- 64-65 end of switch and function

## Contracts, state and data flow
- Pure. The last box stays because the running position ends at last.max − its size = last.min.
- Steps are returned in the boxes' order (by index), not the sorted order.

## Depends on / used by
- uses: core/vector (Point2 type)
- used by: app/app.ts (985-1000: arrangeItems excludes walls and walled/endless kinds; arrange-walls handles walls), app/select-drag.ts (boxOf for the drag's snap boxes)

## Problems found (finding IDs)
- F-0100 (S4): spreading large arrays as arguments; a second boxOf in core/rtree.ts

## To check in other files
- src/app/select-drag.ts:101-111: mine.push(...pts) over the whole selection

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min : Math.min of the spread values; no arguments gives Infinity (lines 16-22, 31)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply : the argument length limit (JavaScriptCore 65,536), most engines throw past it, process large arrays in chunks (F-0100)
