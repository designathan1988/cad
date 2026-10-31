# src/elements/wall/fields.ts
Lines: 326
Summary: The wall panel fields in four sections. General has type with search and thumbnails, what stays on a type change, edit type, reference line and renovation phase. Constraints has base level, base offset (own or type's), top rule (level, fixed, up to a level, under the roof) with its sub-fields and the height. More has thickness, length, chord, radius and end joins. Arrange has align and distribute. nextWall shows the next walls as a template wall with the same fields (F-0030).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: three sections; base offset and top own or the type's, marked with a way back
- 4-13 imports: lengthText, document wall helpers, distance, Field, i18n, layerSwatch, referenceLength, arcOf, schema types, arrange checks
- 15-37 WallFieldActions: update, reference line, type (keep clear or line), keep-clear toggle, reset to type, edit type, radius, arrange, end joins, end sides on screen, first wall's number
- 39-47 REFS (centre, exterior, interior face), JOINS (auto, miter, through, stop, square, off), thickness from the type's layers
- 49-59 wallFields setup: top rule, all-of-kind test, selection, one
- 60-95 general: type search; keep clear/line on type change; edit type (one type selected)
- 96-123 general: reference line segmented with names; phase new/existing/demolish
- 124-151 constraints: base level; base offset (own marker and reset); top select (topRule: F-0086) with own marker and reset
- 152-192 up-to-a-level: which level and offset (same level only); level top offset
- 193-221 height readout for computed tops; fixed height (min 0.01)
- 222-236 more: thickness, length, chord and radius for one arc (min half the chord)
- 237-250 end joins for one wall, named by where each end is on screen
- 251-258 arrange: hint, align, distribute (when possible)
- 260-267 topOptions: level, fixed, up to a level (when there is another), under the roof
- 269-274 levelAbove: the next level up, else the highest other one
- 276-282 topRule: new rules from constants (LEVEL_HEIGHT from document.ts, imported at 5 (F-0139); offset 0) instead of the current height (F-0086)
- 284-285 sameText: one value or "varies"
- 287-288 NEXT_WALL_ID '__next__' (as next-element.ts's NEXT_ID)
- 290-291 NEXT_WALL: the field ids a wall not yet drawn has (type, reference, base offset, top and its sub-fields)
- 293-325 nextWall(doc, defaults, levelId, update): a template DocWall of the tool's settings on the level shown; WallFieldActions whose changes become WallDefaults patches (reset to type sets the type's base/top: wallTop/wallBase of the wall without its own); wallFields over it, general + constraints, kept to NEXT_WALL; returns the fields and the template item (F-0030)

## Contracts, state and data flow
- Data for ui/fields.ts; sets go through the panel's actions (frame.ts updateWalls on the selection).
- One list per element (root cause 1): the next walls are shown with wallFields itself over a template wall (F-0030 fixed). Its "up to a level" now takes the level above the one shown, as a placed wall's.

## Depends on / used by
- uses: ui/units, app/document, core/vector, ui/fields (type), ui/i18n, ui/swatch, opening/derive (referenceLength), wall/geometry/arc, wall/schema, tools/arrange-walls
- used by: the wall kind's panel (elements/kinds/wall.ts), ui/panel.ts and app/ribbon-tabs.ts (nextWall for the next walls)

## Problems found (finding IDs)
- F-0086 (S3): changing the top rule changes the height
- F-0030 fixed: nextWallFields replaced by nextWall over wallFields

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-ED2045E5-90BF-418F-AAD6-3BB1544F34F5.htm : Revit wall Top Constraint, Unconnected Height (from the base), Top Offset (with a level top), Base Offset (lines 124-220, 276-282)
- https://en.wikipedia.org/wiki/Prototype_pattern : new objects made by copying a prototypical instance, configured at run time, instead of a separate factory per type (nextWall: the next wall is a wall, F-0030)
