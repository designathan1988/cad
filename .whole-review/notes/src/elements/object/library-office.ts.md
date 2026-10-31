# src/elements/object/library-office.ts
Lines: 260
Summary: Data: the library's office families — swivel chair on a five-star base, desk (four legs, panels, trestle or sit-stand) with drawer unit and nested monitor, monitors with keyboard and mouse, mobile pedestal, meeting table with nested chairs, industrial shelf with books, steel filing cabinet.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the office families, data only
- 5-6 imports: types; library-kit helpers
- 8-50 OFFICE_CHAIR: params (base, depth, seat, back height, recline, arms, headrest, materials); five base arms 72° apart with casters, hub, gas lift, column, mechanism, seat, back spine and back leaning by the recline, headrest, arm posts and pads; handles; three types
- 52-94 DESK: params (size, base choice, drawer unit, monitor, materials); top; legs, panels and modesty panel, trestle A legs by atan2 and a stretcher, sit-stand columns, feet, frame and control; drawer unit, two drawers and bars; nested monitor; box handles; four types
- 96-124 MONITOR: inches (16:9 factors 0.8716 and 0.4903), 1-3 screens, side ones turned 18° in; picture, neck, stand base; keyboard, keys, mouse; no handles; four types
- 126-152 PEDESTAL: four casters, body, pencil drawer, the other drawers sharing the rest, a handle per drawer (top one capped under the top); two types
- 154-183 MEETING_TABLE: chairs a side counted from the length (0.7 m each), top, two pedestals, cable trough, socket, two rows of nested office chairs facing in; three types
- 185-231 SHELF_BOOKS: shelves and books a shelf counted, four uprights, X brace by atan2, shelves; books in three colour groups spread by `...[0,1,2].map` with `i % 3 == k` filters, varied by `(i*n) % m`; three types
- 233-257 FILING_CABINET: drawers counted from the height (0.33 m each), body, drawers, handles, label holders, lock; two types
- 259 LIBRARY_OFFICE: the list

## Contracts, state and data flow
- Pure data. DESK nests def_monitor and MEETING_TABLE nests def_office_chair (one level each): both definitions must be in the library.
- Books: 3 parts × porPrateleira × (prateleiras − 1) instances evaluated, a third kept by each `when` (up to 3 × 43 × 5 = 645 evaluated at 2.4 × 2.4 m).

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library-families.ts (the library list)

## Problems found (finding IDs)
- F-0061 (S4): "3.60 m, 10 chairs" type gives 8 chairs

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : spread of an array in an array literal inserts its elements in order (line 210)
- https://en.wikipedia.org/wiki/16:9_aspect_ratio : 16:9 width and height factors of the diagonal (line 109-110; opened for library-living.ts, same constants)
