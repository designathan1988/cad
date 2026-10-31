# src/elements/wall/types.ts
Lines: 66
Summary: Commands on wall types: add one (when usable and new), duplicate one under a new id and name, update name/layers/top/base offset, and delete one unless walls use it or it is the last. Editing a type changes every wall of it in one step.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: walls store only the type id; editing a type changes all its walls at once; unusable changes are refused
- 5-8 imports: Doc, Command, stackProblem, wall schema types
- 10 usable: a non-blank name and a stack with layers of positive thickness (no priority-order or minimum-thickness check: F-0091)
- 12-15 addWallType: refused when unusable or the id exists; name trimmed (names may repeat)
- 17-24 duplicateWallType: a copy under a new id and name through addWallType
- 26-32 WallTypePatch: name, layers, top or base offset (undefined takes them off)
- 34-53 updateWallType: merged, top/base dropped when undefined, name trimmed; refused when unusable or unchanged (JSON)
- 55-60 typeDeleteBlocker: missing, last, or used by walls (not the next walls' type: F-0090)
- 62-65 deleteWallType: removed when nothing blocks

## Contracts, state and data flow
- Pure commands. Walls without their own top/base follow the type's (F-0086 Also).

## Depends on / used by
- uses: app/document (type), core/store (type), layers/stack, wall/schema (types)
- used by: ui/types-dialog.ts (all of them), app (setWallType through the panel)

## Problems found (finding IDs)
- F-0090 (S3): deleting the next walls' type
- F-0091 (S4): layer order not checked

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-CCDEE011-2A5E-43AC-BD60-8F81CF432A6B.htm : priorities cannot ascend from the core boundary to the finish face; non-membrane layers at least 4 mm (line 10)
