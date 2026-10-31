# tests/fixtures/third-party.ifc
Lines: 209
Summary: An IFC4 test house made by IfcOpenShell 0.9.0, in millimetres, for the IFC import that was taken out in step 1. It contains:
- a 6 × 4 m ring of four 210 mm walls (block 190 + plaster 20), 2.7 m high, sharing a wall type and a material layer set;
- a 900 × 2100 door in the south wall and a 1200 × 1100 window in the east wall, each in its own opening element (voids and fills);
- an IfcSpace "101 Living";
- a stair with no geometry;
- a 200 mm upper-floor slab on the Upper storey at 3000.
Nothing in src/ or tests/ reads the file now (F-0002).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 STEP header: DesignTransferView, file name and date, IfcOpenShell, IFC4
- 7-18 project, units (mm, m², m³), world placement, the Model context and its Body subcontext
- 19-30 site, building, Ground and Upper (3000) storeys, aggregation, Upper's placement
- 31-41 wall type "Block 210", its layer set (Block 190, Plaster 20), the type relation for four walls, South's layer usage
- 42-58 South: a 6000 × 210 profile extruded 2700; containment of seven elements in Ground; its placement at the origin
- 59-77 East: 4000 × 210, at (6000, 0) turned 90°
- 78-96 North: 6000 × 210, at (6000, 4000) turned 180°
- 97-115 West: 4000 × 210, at (0, 4000) turned −90°
- 116-140 the door's opening (900 × 400 × 2100) voiding South at x 1000; the door 2100 × 900 filling it
- 141-165 the window's opening (1200 × 400 × 1100) voiding East at 1500, sill 1000; the window 1100 × 1200 filling it
- 166-185 IfcSpace 101 "Living": a 5800 × 3800 outline extruded 2700, aggregated into Ground
- 186 IfcStair with no representation
- 187-206 the slab "Upper floor": 6000 × 4000 × 200 below the Upper storey's level, contained in Upper
- 207-208 ENDSEC and END-ISO-10303-21 (line 209 blank)

## Contracts, state and data flow
- A data fixture with no reader since the IFC import was removed. docs/pendencias.md:532 still describes the import as done and tested with this file (F-0002 Also).

## Depends on / used by
- uses: none
- used by: none (orphaned: F-0002)

## Problems found (finding IDs)
- F-0002

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/ISO_10303-21 : the STEP physical file layout: header groups, #n instances, $ for unset values (lines 1-208)
