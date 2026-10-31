# src/elements/object/library-outdoor.ts
Lines: 256
Summary: Data: the library's outdoor families — sun lounger, parasol (open or furled), slatted garden bench, barbecue (brick or kettle), pergola, planter with shrubs, bike rack, fire pit.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the outdoor families, data only
- 4-5 imports: types; library-kit helpers
- 7-40 LOUNGER: params (size, seat height, back raised, cushion, materials); side rails, legs, wheel brackets and wheels, seat slats by count, hinged back tilted by `90 - encosto`, back struts, cushions; a length handle; three types
- 42-70 PARASOL: base, pole; open canopy and valance (revolve), 8 ribs 45° apart; furled canopy when closed; height handle; three types
- 72-102 GARDEN_BENCH: seat slats counted from the depth; steel legs, stretchers, arms and posts, seat slats, back posts and three back slats leaning 15°; types with and without back
- 104-145 BBQ: model choice; brick: base with a cut wood niche, logs, counter, firebox back and sides, grill bars, skewers, lintel, hood sloped by atan2, hood body, flue to the ceiling; kettle: bowl, lid (revolve), handle, three legs, tray; a width handle; three types
- 147-175 PERGOLA: slats counted from spacing; four posts, two beams, slats over them, optional glass cover; three types
- 177-204 PLANTER: plants counted from the width; planter with its inside cut, soil, shrubs varied by `(i*n) % m`; three types
- 206-228 BIKE_RACK: places counted (two per inverted U every 0.8 m); legs, top bars, base plates; length handle; two types
- 230-253 FIRE_PIT: rim as a turned cup, embers, four logs, three flames when lit; width handle; two types
- 255 LIBRARY_OUTDOOR: the list

## Contracts, state and data flow
- Pure data; counted params are resolved after the free ones whatever their order (evaluate.ts:97-111), so `vagas` before `largura` (212-213) is fine.
- Revolve parts become THREE.LatheGeometry (kinds/object.ts:238): x is the radius, y the height, revolved round the vertical axis.

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library-families.ts (the library list)

## Problems found (finding IDs)
- F-0062 (S4): fire pit floor under the ground below 12 cm
- F-0063 (S4): kettle barbecue's width handle changes nothing

## To check in other files
- three's docs say each lathe point's x must be greater than zero; several profiles here end at x = 0 (58, 134, 243, 246): see how kinds/object.ts:238 builds them (closing a tip at the axis is common and works, but the axis vertices' normals are degenerate).

## Sources
- https://threejs.org/docs/pages/LatheGeometry.html : LatheGeometry takes Vector2 (x radius, y height), revolves about Y, x must be > 0 (lines 58-62, 133-134, 243, 246)
