# src/elements/wall/schema.ts
Lines: 75
Summary: Wall data: ids, ends, reference line (centre, interior face, exterior face), Revit's layer functions and their join priorities, layers, the top rule (level, fixed, up to a level, under the roof), wall types with optional top and base offset, the user's end joins, the wall (what the user decided) and an end reference.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 import: the Point2 type from core/vector
- 3-7 WallId, WallTypeId, MaterialId, WallEnd, ReferenceLine (three of Revit's six location lines)
- 9-19 LayerFunction (structure, substrate, thermal, finish 1, finish 2; no membrane) and LAYER_PRIORITY (1 highest)
- 21-25 WallLayer: thickness, function, material
- 27-36 HeightRule: level + offset, fixed height, up to a level + offset, under the roofs
- 38-48 WallType: id, name, layers from the exterior face (right of the drawing direction), optional top and base offset
- 50-56 EndJoin: off, through, stop, miter, square (the doc comment explains all but square)
- 58-69 Wall: id, type, start, end, reference line, bulge (DXF), the user's end joins
- 71-74 EndRef: a wall id and one of its ends

## Contracts, state and data flow
- Types only. A wall stores what the user decided; thickness, layers and core come from its type (shape.ts). Base offset and top live on DocWall/type (app/document.ts).
- End-join choices are stored per end name, so anything that swaps ends (flip.ts) must swap them (F-0087).

## Depends on / used by
- uses: core/vector (type)
- used by: all wall modules, join engine, app/document (DocWall extends Wall), opening and dimension code (WallId, EndRef), io/project-file

## Problems found (finding IDs)
- none (EndJoin's comment omits 'square'; joins named by end: F-0087)

## To check in other files
- none

## Sources
- https://rvtdocs.com/2026/Autodesk.Revit.DB.WallLocationLine : Revit's six location lines (wall/core centre, core faces, finish faces); this schema keeps three (line 7)
