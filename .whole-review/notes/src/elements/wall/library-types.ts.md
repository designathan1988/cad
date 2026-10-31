# src/elements/wall/library-types.ts
Lines: 67
Summary: Data: the wall types a project starts with beyond the first four, and that an older file gets (version 57). These are Brazilian construction's usual walls, each with its real layers and materials: ceramic and concrete blocks, exposed brick, a tiled bathroom wall, fair-faced concrete, drywall (wet, acoustic, slatted), steel frame, ETICS, stone, stone cladding and a boundary wall.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: types besides the first four; added to older files (v57); named in English, Portuguese by i18n
- 6 import: the WallType type from the wall schema
- 8 plaster(): a plaster layer of a thickness on the finish 1 or finish 2 side
- 10-15 ceramic block 9 and 14, concrete block 14 and 19 (structural), exposed brick 11
- 16-21 masonry 15 tiled one side; fair-faced concrete 15
- 22-37 drywall 10 moisture-resistant; drywall 15 acoustic double (no structure layer: the whole wall is the core)
- 38-48 steel frame 16 external: cement board, OSB, insulation, gypsum (no structure layer)
- 49-54 ETICS masonry 20 (finish, EPS, block, plaster); stone 30
- 55-66 masonry 15 with stone cladding; drywall 10 with wood slats; boundary wall 15

## Contracts, state and data flow
- Pure data. Functions follow Revit's priorities (structure 1 … finish 2 5). None ascends from its core to a face. Types without a structure layer take the whole wall as core (shape.ts coreLayersOf), so their finishes do not wrap at joins.

## Depends on / used by
- uses: wall/schema (WallType)
- used by: app/document.ts (new projects' wall types), io/project-file.ts (v57 migration), ui/i18n.ts (Portuguese names)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://rvtdocs.com/2026/Autodesk.Revit.DB.MaterialFunctionAssignment : Revit's layer functions and priorities (structure 1, substrate 2, insulation 3, finish 1 4, finish 2 5) (lines 8-66)
