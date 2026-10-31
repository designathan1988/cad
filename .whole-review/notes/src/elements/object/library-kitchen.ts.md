# src/elements/object/library-kitchen.ts
Lines: 422
Summary: Data: the library's kitchen, dining and laundry families — upholstered chair, round table with nested chairs, bar stool, kitchen island with hob, sink and nested stools, cooker hood (with a height rule), oven tower, dishwasher, washer/dryer, laundry tub, wine cooler.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: kitchen, dining and laundry families, data only
- 5-6 imports: types; library-kit helpers
- 8-41 DINING_CHAIR: seat, reclined back, tapered splayed legs, optional arms; handles; types
- 43-102 ROUND_TABLE: top and edge, a turned pedestal or four legs, and nested dining chairs round it, each turned to face the centre, their materials passed down by name; handles; types
- 104-138 BAR_STOOL: turned seat, low back, four splayed legs with foot rails, or a swivel column with a foot ring (a disc with its middle cut) and plate; types
- 140-197 ISLAND: plinth, carcass, drawer fronts by unit and row, handles, worktop with overhang, hob and burners, sink bowl cut with lining, tap, spout, lever, and nested bar stools on the overhang side (when the overhang is over 15 cm), their seat height from the worktop's
- 199-236 HOOD: body, pyramid sides tilted by atan2 (degrees, formula.ts), pyramid top, chimney (wall or island), slanted glass model, filters; a rule under 65 cm above a 90 cm worktop
- 238-272 OVEN_TOWER: today's version (compare library-before66.ts): carcass, doors, oven and its window, handle, controls, knobs, microwave, plinth; types
- 274-298 DISHWASHER: body, control panel, buttons, handle, plinth; types
- 300-328 WASHER: one or two stacked machines: body, door ring and glass, detergent drawer, dial, display; types
- 330-361 LAUNDRY_TUB: tub with its bowl cut, washboard tilted 35°, cabinet with doors or a pedestal, tap and handle; types
- 363-379 WINE_COOLER: parameters (sizes, shelves and bottles counted from them, materials) and its body
- 380-406 its shelves and the bottles lying on them with their necks (a 1.80 m one: 15 shelves × 6 bottles, 180 pieces)
- 407-419 the door frame with its opening cut (a CSG cut on the door; its box also touches the shelves' front edge, so they are cut too and their crease edges computed: F-0052's cost), glass, handle bar; types
- 421 LIBRARY_KITCHEN: the list

## Contracts, state and data flow
- The round table and the island nest the chair and the stool definitions (one level): both must be present.
- The hood's rule warns under 65 cm above a 90 cm worktop, the usual minimum for gas hobs (EN 60335-2-31 as cited by manufacturers).

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library-families.ts (batch 52)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.teka.com/global/?p=151642 : gas hobs at least 65 cm (UNE-EN 60335-2-31), induction 55-60 cm (line 235's rule)
