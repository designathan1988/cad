# src/elements/object/library-equipment.ts
Lines: 280
Summary: Data: the library's equipment — split air conditioner (indoor/outdoor, sized by BTU), ceiling fan with light, water heater (gas, upright or horizontal boiler sized by litres), distribution board (rows of DIN breakers), piano (upright or grand with a profile rim), treadmill, water tank (by capacity), solar water heater (collectors and a nested horizontal boiler).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: data only
- 6-7 imports: types; library-kit helpers (derived for sizes from formulas)
- 9-12 light(): power and colour temperature (a second copy of library-decor.ts's helper)
- 14-47 SPLIT_AC: unit, capacity, mounting height; sizes derived from capacity; indoor body, louver, display; outdoor cabinet, grille, blades, fins, brackets; types
- 49-80 CEILING_FAN: canopy, downrod, turned motor, blade irons and pitched blades around it, globe; its light (× luz: none when off)
- 82-113 WATER_HEATER: gas box, flue, display, connections; upright boiler radius √(V / π / 1.4) for 1.4 m height (V = πr²h; sqrt of a positive volume) and its top; horizontal boiler of 0.3 m radius, length from the volume, on saddles
- 115-143 ELECTRIC_PANEL: size from the number of DIN modules (18 a row); door with a window, or the breakers and toggles row by row
- 145-198 PIANO: upright case, keybed, keyboard, 36 black keys placed by the 2-3 pattern, music desk, toes; grand profile rim, keyboard, keys, key slip, three legs, raised lid
- 200-222 TREADMILL: deck, belt, feet, tilted uprights, console, screen, handrails
- 224-249 WATER_TANK: capacity → top diameter and height; truncated cone, rim, lid, inlet, outlet; the tank's material is "velvet" (a fabric used for its blue colour: its roughness and name are a fabric's)
- 251-277 SOLAR_HEATER: collectors and glazing tilted, stands, and a nested water heater (horizontal, litres from collectors)
- 279 LIBRARY_EQUIPMENT: the list

## Contracts, state and data flow
- The solar heater nests def_water_heater (one level): both must be in the project's definitions.

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library.ts

## Problems found (finding IDs)
- none (a fabric material reused for a plastic tank; a duplicated helper)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/sqrt : NaN for negative arguments (lines 91, 101-102 take the root of a positive volume)
