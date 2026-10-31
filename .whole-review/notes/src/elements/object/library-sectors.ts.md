# src/elements/object/library-sectors.ts
Lines: 545
Summary: Data: the library's other sectors — children (table with little chairs, toy chest, house bed, changing dresser), commerce (reception desk, gondola, booth, clothes rack), health (hospital bed, exam couch, wheelchair with the NBR 9050 module) and school (desks in rows, whiteboard, lockers, teacher's desk).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: children, commerce, health and school sectors, data only
- 7-8 imports: types; library-kit helpers
- 10-37 KIDS_TABLE: top, four splayed tapered legs, up to 4 nested dining chairs resized as little chairs (values pass materials by name), split between the long sides; types
- 39-86 TOY_CHEST: bottom and four sides (not a cut, so the toys stay), plinth, lid hinged at the back by `tilt: 180 + tampa`, blocks spread by `.map` and a ball when open; types
- 88-117 HOUSE_BED: base, mattress, four posts, rafters by atan2 meeting at the ridge, ridge, eaves rails; height handle; types
- 119-147 CHANGING_DRESSER: body, drawers and knobs by count, feet, changing rim on three sides and pad; types
- 149-187 RECEPTION_DESK: front panel and transaction top, plinth, lowered accessible part (0.9 m at 0.73 m), work top, drawer unit, return on the left; types; NBR 9050 rule (F-0064)
- 189-229 GONDOLA: base, back panel, shelves both sides by count, goods in three colour groups (`.map`, `i % 3`) on each level, heights capped under the shelf above; types (the comment says shelves slope, they do not)
- 231-261 BOOTH: two benches back to back, seats, backs tilted ±6°, capitonné channels, table top, column and foot; types
- 263-300 CLOTHES_RACK: uprights, feet, rail; garments counted from the width: hooks, hanger arms, then by `.flatMap` shoulders, bodies and sleeves in three groups, `long` rewritten per sleeve with `.replace(/\bi\b/g, ...)`; width handle; types
- 302-343 HOSPITAL_BED: casters, base frame, lifts, deck, mattress in two parts (the back raised), head and foot boards, side rail posts and tubes, IV pole, hook and bag; types
- 345-376 EXAM_COUCH: legs, stretchers, pad, head section raised, a two-step stool (steps, treads, six legs, rails); two types
- 378-414 WHEELCHAIR: rear wheels, push rims, hubs, casters, side tubes, seat, back, push handles, footplates and hangers, front posts, armrests and posts; the 0.80 × 1.20 m NBR 9050 reference module on the floor; no handles; two types
- 416-455 SCHOOL_DESKS: rows × columns, overall size derived; per desk top, four legs, rails, book tray with sides and front; per chair seat, legs, rails, back posts and back; no handles; types of 1, 30, 20
- 457-489 WHITEBOARD: frame, surface white or green (`.map` of [when, material] pairs), tray, three markers, eraser; optional mobile stand (uprights, feet, castors, rail); width handle; three types
- 491-519 LOCKERS: columns × doors, width derived; body, doors, four vent slots cut per door, lock, number plate; no handles; three types
- 521-542 TEACHER_DESK: top, modesty panel, pedestal with three drawers on the teacher's side (+y), end panel; one type
- 544 LIBRARY_SECTORS: the list

## Contracts, state and data flow
- Pure data. KIDS_TABLE nests def_dining_chair (library-kitchen.ts) with sizes and materials passed by name.
- `.map`/`.flatMap` build part lists at module load; `.replace(/\bi\b/g, 'floor(i / 2)')` rewrites every standalone `i` in the sleeve formulas (no `$` in the replacement, so it is literal).
- LOCKERS' vent slots are cuts (`cut: true`): up to 10 × 4 × 4 = 160 CSG cuts on one object (cost: F-0052's crease-edge pass on each cut piece).

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library-families.ts (the library list)

## Problems found (finding IDs)
- F-0064 (S4): reception desk NBR 9050 message gives 90 cm as a height

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replace : a /g regex replaces every match; replacement without `$` is literal (line 291)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap : map then flatten one level (line 284)
- https://www.boaconta.com.br/blog/laudo-acessibilidade-nbr-9050/ : accessible counter part lowered to 0.75–0.85 m (lines 172-174, 186; with the search results quoting the norm's 0.90 m minimum width)
