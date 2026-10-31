# src/elements/object/library-living.ts
Lines: 411
Summary: Data: the library's living room families — armchair, sofa with chaise, coffee table, side table, television sized by inches, TV unit with slatted panel, sideboard with reeded doors, rug, pouf.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: living room families, data only, sizes/materials/build as parameters
- 5-6 imports: types; library-kit helpers
- 8-55 ARMCHAIR: base, seat cushion, reclined back and its cushion, arms, splayed tapered legs; types; a rule for seats over 48 cm
- 57-124 CHAISE_SOFA: base and the chaise's base on its side, seat cushions by count, chaise cushion, back, arm, throw cushions, legs; handles (one dragging the chaise's length); types
- 126-173 COFFEE_TABLE: rectangular (top, square legs, shelf, rails) or round (top, turned pedestal); types
- 175-201 SIDE_TABLE: base, stem, top, optional tray rim; types
- 203-234 TELEVISION: size by inches (16:9: width 0.8716 and height 0.4903 of the diagonal), panel, screen, back casing, feet unless on the wall; types; a rule over 90"
- 236-283 TV_UNIT: carcass, doors with cut finger pulls, legs, slatted panel behind (slats every 5 cm); types
- 285-329 SIDEBOARD: carcass, top, doors, reeds every 2.8 cm across the whole front, knobs, splayed legs; types
- 331-363 RUG: rectangular field and border band, or round field and ring; handles; types
- 365-400 POUF: a turned cushion or a rounded box; its first handle
- 401-408 its height handle and three types
- 410 LIBRARY_LIVING: the list

## Contracts, state and data flow
- Pure data (batch 50).

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library-families.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/16:9_aspect_ratio : the 16:9 ratio; width and height are 16/√337 and 9/√337 of the diagonal (lines 211-212)
