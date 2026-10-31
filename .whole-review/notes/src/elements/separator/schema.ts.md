# src/elements/separator/schema.ts
Lines: 27
Summary: Room separators: a line on a level that bounds rooms where no wall stands (Revit's room separation lines). Rooms read it as a wall strip 2 mm wide, extended 5 mm past each end to meet wall faces.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: bounds rooms without a wall, nothing built, drawn thin
- 5 imports: vector add, normalize, perp, scale, sub, Point2
- 7 SEPARATOR_PREFIX: the id prefix 'sep'
- 9-14 Separator: id, level, start, end
- 16-17 SEPARATOR_HALF: 1 mm half-width
- 19-26 separatorStrip: a ccw strip along the line, 5 mm past each end

## Contracts, state and data flow
- Pure. The strip joins the wall pieces of the level in room derivation (room/derive.ts takes the pieces). An end drawn short of a wall by more than 5 mm leaves the space unsplit, with no warning.

## Depends on / used by
- uses: core/vector
- used by: app/geometry (pieces by level for rooms), elements/kinds/separator.ts, separator/commands, the separator tool

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-6B8BDC71-D0A4-4ABA-8561-34F7AD6BAB55.htm : room separation lines bound rooms where no wall exists (lines 1-3)
