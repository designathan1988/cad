# src/elements/room/fields.ts
Lines: 239
Summary: The panel fields for rooms and for floors, slabs and ceilings. Rooms show name, number, use, own height (with reset), area, perimeter, volume, finishes (floor, wall, ceiling, skirting) and interior elevations. Floors show thickness, offset, source, area, slope and its direction, holes, build-up and layers, tiling (size, joint, pattern, angle, piece count), and hole and edge-railing actions.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: room and floor fields for ui/fields.ts
- 3-9 imports: area/length/volume text, Field, i18n, Material, RoomPatch, solids, schema lists and types
- 11-29 RoomFieldActions: room updates, level height, floor update, hole tools, edge railing, materials, layers, tiling, interior elevations
- 31-34 `one` (exactly one selected) and RoomOwnActions
- 36-61 roomFields: name and number for one room; use (none or a use); height with "own" marker and reset to the level's
- 62-66 total area, perimeter (one), volume = area × height (comment mentions a schedule: F-0036 Also)
- 67-88 finishes: floor, wall and ceiling materials (none or a material), skirting height (≤ 0 removes)
- 89-94 interior elevations action when offered and some room is enclosed (comment mentions a sheet)
- 96-113 floorFields: thickness (min 0.01), offset, source readout (room's name or outline), area
- 114-133 slope in fixed % with no bounds, and its direction in degrees; each writes the first floor's other component on all (F-0082)
- 134 hole count readout
- 135-165 build-up select (none, the usual ones, custom when edited) and, for one floor, each layer's thickness
- 166-179 tiled yes/no (default 60 × 60, 2 mm, grid, 0°) and the tiling fields
- 180-199 add a hole (one floor), clear holes (own holes only), an edge guardrail (one floor, when it has none)
- 200-202 buildupOf: the usual build-up equal by JSON, else null
- 204-208 DEFAULT_TILING and TILE_WASTE 10 %
- 210-211 tilesFor: ceil(area / ((w + joint)(l + joint)) × 1.1)
- 213-238 tilingFields: width, length, joint, pattern, angle (from the first tiled floor's base), piece count

## Contracts, state and data flow
- Data for ui/fields.ts; sets dispatch room/commands through the actions.
- Slopes here are stored and shown in percent; roofs convert to the project's unit (F-0082).

## Depends on / used by
- uses: ui/units, ui/fields (type), ui/i18n, material/schema (type), room/commands (type), room/derive (types), room/schema
- used by: the room and floor kinds' panels (elements/kinds/room.ts, floor.ts), app/room-ui.ts

## Problems found (finding IDs)
- F-0082 (S4): floor slope in fixed % and first floor's component applied to all
- F-0036 (Also): schedule/sheet comments

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/ceil : rounds toward +∞ (tile count, line 211)
