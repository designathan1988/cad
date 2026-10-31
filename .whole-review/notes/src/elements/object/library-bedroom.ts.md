# src/elements/object/library-bedroom.ts
Lines: 387
Summary: Data: the library's bedroom definitions — box bed with upholstered headboard and bedding, nightstand, chest of drawers, wardrobe (hinged or sliding, top cupboards, mirror), crib (with a bar-gap rule), bunk bed (with a guard rule), dressing table with round mirror, bed bench.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: data only, as library.ts
- 5-6 imports: ObjectDefinition; library-kit helpers
- 8-78 BOX_BED: mattress sizes, headboard height and wings, panel and pillow counts (counted formulas), throw; parts feet, base, mattress, duvet, pillows tilted 62°, throw and its hanging sides, headboard backing and panels; four handles; types queen/king/double/single
- 80-107 NIGHTSTAND: carcass, drawers by count, knobs, splayed legs; types
- 109-162 DRESSER: plinth, carcass, drawers by column and row (i % colunas, floor(i / colunas)), bar pulls; types
- 164-264 WARDROBE: plinth, carcass; hinged doors per module with bar handles at meeting edges; sliding doors overlapping on two tracks with pull profiles; the mirror on the first door; top cupboard doors with cut pulls; types
- 266-296 CRIB: posts, rails, end panels, bars on both long sides (count from the length), base, mattress; types; a rule when the gap between bars passes 6.5 cm, citing NBR 15860 (the 4.5–6.5 cm range is found in manuals and for EN 716; the Brazilian standard's text was not reachable)
- 298-330 BUNK_BED: posts, side and end rails per bed, mattresses, upper guard rail, ladder stiles and rungs; types; a rule when the upper guard is under 16 cm above the mattress
- 332-360 VANITY: top, drawer, knob, legs, round mirror in a frame on a stand; types
- 362-384 BENCH: upholstered seat, frame, legs; types
- 386 LIBRARY_BEDROOM: the list

## Contracts, state and data flow
- Pure data; repeats are bounded by small counts (bars ≈ 18, rungs ≈ 5).

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (type)
- used by: elements/object/library.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://alcuinfonds.be/blog/avec-normes-pour-berceau/ : bar spacing 4.5 to 6.5 cm (maximum 7) under NF EN 716 (line 295's 6.5 cm rule)
