# src/elements/wall/type-fields.ts
Lines: 58
Summary: The fields of a wall type in its dialog: name, top (level's height or fixed), its offset or height, and base offset. Values equal to a wall's own defaults are stored as none.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: name, top and base offset by the same renderer as the panel; defaults stored as none
- 5-9 imports: Field, name and t, WallType, WallTypePatch, LEVEL_HEIGHT (app/document, F-0139)
- 11-13 WallTypeFieldActions: update with a patch
- 15-16 wallTypeFields: the top's kind, level when none
- 17-18 name text field
- 19-29 top segmented: level or fixed only (a wall offers four); "fixed" sets LEVEL_HEIGHT (2.80 m) (F-0086 Also)
- 30-38 level offset (0 stores none)
- 39-48 fixed height (min 0.01)
- 49-57 base offset (0 stores none); the list closes

## Contracts, state and data flow
- Data for ui/fields.ts in the types dialog; patches go to wall/types.ts (updateWallType). Walls without their own values follow the type, so a type change moves every such wall.
- In Revit, top constraint and unconnected height are instance properties, not type ones.

## Depends on / used by
- uses: ui/fields (type), ui/i18n, wall/schema (type), wall/types (type), app/document (LEVEL_HEIGHT)
- used by: ui/types-dialog.ts

## Problems found (finding IDs)
- F-0086 (Also): type top switch to fixed sets the default 2.80 m whatever the walls' height now; a third list of the top options (RC1)
- F-0139 fixed (line 28 reads LEVEL_HEIGHT)

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-F1AD4E4F-3505-4B3F-8096-61BAC86B7ACC.htm : Revit lists Top Constraint, Unconnected Height and Base Offset among a wall's instance properties (lines 19-56)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant instead of a repeated literal (LEVEL_HEIGHT, F-0139)
