# src/elements/kinds/paint.ts
Lines: 58
Summary: Helpers shared by the kinds: tracing a polygon on the plan's canvas, a point-near-segment test, and adapting an element's fields so they read through the kind's derived item.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: tracing and fields read through the derived form
- 4-6 imports: Point2, Field, PlanPaint (types)
- 8-18 trace: beginPath, the points on screen, closePath when closed (closePath only adds the closing segment; nothing is drawn until fill/stroke)
- 20-27 nearSegment: the distance to the clamped projection within near (the same computation as dimension/anchor.ts segmentDistance and kinds/opening.ts toLines: three copies)
- 29-37 throughElement: each field's when and own mapped over the derived items
- 38-57 readout/note text, action enabled, number get and min (function or value), others' get, through `of`; every items-taking member of Field (ui/fields.ts:23, 25, 40, 55, 57, 59) is covered

## Contracts, state and data flow
- Pure; the canvas path is begun anew by trace.

## Depends on / used by
- uses: types only
- used by: every elements/kinds/*.ts (trace, nearSegment, throughElement)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/closePath : adds a straight line back to the start, draws nothing itself, does nothing for one point (line 17)
