# tests/fixtures/third-party-structure.ifc
Lines: 82
Summary: An IFC4 test file made by IfcOpenShell 0.9.0, in millimetres. It holds a project, a site, a building and two storeys (Ground at 0, Upper at 3000). On Ground there are three structural members: a 300 × 500 rectangular column C1 (2.8 m, turned 30°), a round column C2 of radius 150 (3 m) and an I400 beam V1 (5 m long, laid along y at 2.8 m). It was used by the IFC import, which was taken out in step 1; nothing in src/ or tests/ reads it now (F-0002).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 STEP header: FILE_DESCRIPTION (CoordinationView), FILE_NAME (date, IfcOpenShell), FILE_SCHEMA IFC4
- 7-16 DATA: the project, millimetre unit, the world placement and the Body representation context
- 17-23 site, building, two storeys (elevations 0 and 3000) and their aggregation
- 24-33 the two storeys' local placements (z 0 and 3000)
- 34-43 C1: a 300 × 500 rectangle profile extruded 2799.9999999999995 (a float trace of 2.8 m)
- 44-53 C2: a circle of radius 150 extruded 3000
- 54-63 V1: an I profile 150 × 400 (web 8, flange 12) extruded 5000
- 64 the three members contained in Ground
- 65-79 placements: C2 at (4000, 1000); C1 at (2000, 1000) turned 30°; V1 at (0, 3000, 2800) with its axis along x
- 80-81 ENDSEC and END-ISO-10303-21 (line 82 blank)

## Contracts, state and data flow
- A data fixture. Its only reader (io/import-ifc.ts) was removed with the exports and IFC import; docs/pendencias.md:532 still records the import as tested with tests/fixtures/third-party.ifc.

## Depends on / used by
- uses: none
- used by: none (orphaned: F-0002)

## Problems found (finding IDs)
- F-0002 (this fixture is one of the orphans)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/ISO_10303-21 : the STEP physical file layout: HEADER groups, DATA with #n instances, $ for unset values (lines 1-81)
