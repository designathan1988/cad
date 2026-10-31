# src/elements/object/library-more.ts
Lines: 464
Summary: Data: phase 8's object definitions — sofa, bed, kitchen units, toilet, washbasin, shower, fridge, cooker, pendant with its light, tree, potted plant — as parameters, formula-driven parts, handles, types and rules.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: phase 8 categories (sofa, bed, kitchen units, toilet, washbasin, shower, fridge, cooker, pendant, tree, potted plant); axes
- 6 imports: ObjectDefinition, ParamDef
- 8-28 local helpers len, mat, BUILD, LIGHT and boxHandles with `as const` casts (copies of library-kit.ts's, written before it)
- 30-68 SOFA: base, cushions by count, back, arms, legs; types; a shallow-seat rule
- 70-112 BED: frame, mattress, headboard, pillows; handles (the foot moves, the head stays); types
- 114-197 KITCHEN: plinth, carcass, doors and bar handles per unit (count from the widest unit), worktop, wall units with doors and handles; types; a low-worktop rule
- 199-224 TOILET: foot, bowl, cistern, base; types (accessible 46 cm)
- 226-255 WASHBASIN: counter, basin, tap column and spout, cabinet and handle; types
- 257-290 SHOWER: floor, pipe, arm, head, valve, glass screens; types; a tight-enclosure rule
- 292-324 FRIDGE: today's version (compare library-before66.ts): body, plinth and vent grille, doors, dispenser on wider ones, bar handles on stand-offs; types
- 326-362 COOKER: today's version (compare library-before65.ts): plinth, body, black glass top, back panel and knobs, burners with caps, grates (two bars per burner), oven door, window, handle, drawer; types
- 364-392 PENDANT: shade, cord to the ceiling, canopy; power and colour temperature; its light; a rule under 1.60 m
- 394-405 TREE: parameters (crown width, height, trunk diameter, clear trunk, crown and bark materials)
- 406-425 TREE parts: tapered trunk, 4 branches tilted 35° turned 97° apart, crown core, 22 crown clusters on a spheroid by the golden angle (137.5°), sizes varied by `i % 3`
- 426-434 TREE handles (width at crown mid-height, height) and types small/big
- 436-460 POT_PLANT: pot, rim, soil, 7 inner and 9 outer leaf blades fanned round the stem; handles; one type
- 462-463 LIBRARY_MORE: the list in ribbon/library order

## Contracts, state and data flow
- Pure data, evaluated by evaluate.ts through formula.ts (which supports `%`, sqrt and degree sin/cos: formula.ts:20, 87, 108-110, 179).
- sqrt(1 - t²) with t = 1 - 2(i+0.5)/22 stays in (0,1], never negative.

## Depends on / used by
- uses: elements/object/schema.ts (types)
- used by: elements/object/library.ts / library-families.ts (the library list)

## Problems found (finding IDs)
- none (local helper copies of library-kit.ts, cosmetic, already noted for library-lights.ts)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Golden_angle : the golden angle ≈137.5°, used to spread points without alignment (lines 407, 418-419)
