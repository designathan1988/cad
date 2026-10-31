# src/tools/smart-guides.ts
Lines: 72
Summary: Smart guides while dragging a selection in plan: the moved box snaps, per axis, to the nearest alignment of its edges or centre with another box's, or to the equal-gap position between its nearest neighbours on either side (preferred when as near); returns the adjusted offset plus the alignment lines and the two gap marks to draw.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: edges and centres, equal gaps, pure (offset in, offset kept and drawing out)
- 6-7 imports: Point2 and Box (tools/arrange)
- 9-20 Segment and SmartGuides (delta, alignment lines, gap segments)
- 22-24 moved (a box shifted), marks (min, centre, max on an axis), overlap (along an axis)
- 26-33 smartGuides setup per axis: the other axis, the box at the current offset
- 34-36 best alignment: every mark of every other box against the box's three marks, nearest within r
- 37-47 equal gaps: neighbours lying across from it; the nearest before and after; the gap that centres it between them; taken when positive and within r
- 48-51 equal gaps win when at least as near; the offset adjusted on this axis
- 52-60 gaps drawn: from the lower neighbour to the box and from the box to the upper one, at the middle of their shared band
- 61-68 alignment lines: every box sharing a mark with it now (within 1e-9), the line across all of them
- 69-71 the offset and the drawing returned

## Contracts, state and data flow
- Pure; O(others) per axis with small constants. Boxes are axis-aligned, so an oblique wall aligns by its bounding box.

## Depends on / used by
- uses: core/vector (Point2), tools/arrange (Box)
- used by: app/select-drag.ts:224-227 (plan drags with snaps on and no Shift; reach SMART_PX in pixels)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://help.figma.com/hc/en-us/articles/360039956914-Adjust-the-spacing-between-layers : Snap to objects aligns centers and outermost points of objects, shown by a red guide; Control turns it off for a moment (lines 1-68, the model this follows)
