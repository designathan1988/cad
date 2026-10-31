# src/elements/object/library-lights.ts
Lines: 110
Summary: Data: the library's basic luminaires, each with its own power and colour temperature — recessed downlight, wall sconce, floor lamp, garden post, bare point of light.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: each luminaire's own light parameters (W of LED, about 100 lm each; K); axes as the other library files
- 7 imports: ObjectDefinition, ParamDef
- 9-24 local len, mat and light helpers (copies of library-kit.ts's len and mat, and the third copy of light(), also in library-decor.ts and library-equipment.ts)
- 26-38 DOWNLIGHT: trim at the ceiling; warm and neutral (4000 K) types; light 5 cm under the ceiling
- 40-55 SCONCE: back plate, flared diffuser; light at its mounting height
- 57-73 FLOOR_LAMP: base, stem, shade; light inside the shade
- 75-91 GARDEN_POST: post, lantern, cap; low and tall types
- 93-106 POINT_LIGHT: a bulb hanging from its socket
- 108-109 LIBRARY_LIGHTS: the list, added to files from before it (project-file.ts)

## Contracts, state and data flow
- Colour temperatures 2200–6500 K cover warm (2700 K) to daylight (6500 K) lamps.

## Depends on / used by
- uses: elements/object/schema.ts (types)
- used by: elements/object/library.ts, io/project-file.ts

## Problems found (finding IDs)
- none (duplicated helpers, cosmetic)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Color_temperature : CCT in kelvins; warmer is lower, 6500 K a daylight standard (lines 22-23, 35)
