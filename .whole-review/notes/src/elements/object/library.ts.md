# src/elements/object/library.ts
Lines: 281
Summary: The object library a project starts with: the phase 3 definitions written here (table, bookcase, cabinet, chair, dining set nesting the table and chairs), followed by every other library file's list in LIBRARY.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: data only, the same evaluation as any definition; axes and the front facing −y
- 6-9 imports: LIBRARY_FAMILIES, types, LIBRARY_MORE, LIBRARY_LIGHTS
- 11-23 local len (5 mm step, optional group by conditional spread), mat, DIM and BUILD groups (older copies of library-kit.ts's)
- 25-70 TABLE: params (sizes, top thickness, leg size, inset, materials); top and four legs; five handles (width both sides, depth both sides, height); three types; rules (legs do not fit, span over 2.40 m)
- 72-126 BOOKCASE: params (sizes, board, shelf spacing, back, counted shelves, books, books a shelf); sides, base and top, back, shelves evenly spaced; four book parts that differ only in their `i % 4` and material, each repeating the full count (F-0065); four handles; three types; a sag rule over 90 cm
- 128-191 CABINET: params (sizes, board, plinth, widest door, handles, doors counted, door width derived); sides, base and top, back, plinth, shelf, doors, handles on the side away from the hinge; four handles; three types; a rule for hangers under 50 cm deep
- 193-230 CHAIR: seat, back and back rail between the rear legs, four legs (rear ones rising to the back's height); two handles; one type; a seat-height rule 40-50 cm
- 232-277 DINING_SET: chairs a side counted from the width and room per chair; nested table (values passed by name), two rows of nested chairs facing in, end chairs when asked; three handles; four- and six-seat types
- 279-280 LIBRARY: these five, then LIBRARY_MORE, LIBRARY_LIGHTS, LIBRARY_FAMILIES

## Contracts, state and data flow
- LIBRARY is what a new project gets and what an older file is topped up with (comment line 279; see io/project-file.ts).
- DINING_SET nests def_table and def_chair; the table gets width, depth and top material from the set by name.
- The four book parts each evaluate porNivel × (prateleiras + 1) copies; evaluate.ts caps each part at 500 (evaluate.ts:222-223).

## Depends on / used by
- uses: library-families.ts, library-more.ts, library-lights.ts, schema.ts (types)
- used by: the object library UI and io/project-file.ts (definitions of new and older files)

## Problems found (finding IDs)
- F-0065 (S3): bookcase within its ranges passes the 500-copy cap; books evaluated four times

## To check in other files
- src/elements/object/schema.ts: whether a part's material may be a formula (for F-0065's fix)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : spreading an empty object adds no property (line 19); spreading arrays into an array literal keeps their order (line 280)
