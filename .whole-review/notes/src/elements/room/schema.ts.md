# src/elements/room/schema.ts
Lines: 119
Summary: Room and floor data. A room is a seed point on a level with name, number, use, own height and finishes, its outline always derived. A floor (slab or ceiling) follows a room or its own outline, with thickness, offset, holes, slope, tiling and build-up layers. The file also holds the usual build-ups and the defaults.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: only what the user decided; outlines derived
- 5-6 imports: LevelId and Point2 types
- 8-9 RoomId and FloorId string aliases
- 11-13 ROOM_USES (`as const`) and RoomUse as its union
- 15-27 Room: id, level, seed, name, number, use, own height, finishes
- 29-35 RoomFinishes: floor, wall, ceiling material ids and skirting height
- 37-48 TILE_PATTERNS and Tiling: piece width and length, joint, pattern, angle (degrees)
- 50-54 FloorLayer: material id and thickness, top down
- 56-58 FloorSource: a room's outline or its own points
- 60-78 Floor: id, level, source, thickness, offset of the top (lowest corner when sloped), holes, slope (grade %, dir rad), kind ceiling, tiling, layers
- 80-113 FLOOR_BUILDUPS: tiled, wood, ground slab, gypsum ceiling, porcelain, vinyl, laminate, parquet, burnt cement, marble, terrazzo, hydraulic tile, carpet, deck, outdoor stone and flagstone, wood and PVC ceilings
- 115-116 CEILING_THICKNESS 2 cm
- 118 FLOOR_DEFAULTS: 15 cm thick at the level

## Contracts, state and data flow
- Pure data. Floor build-ups name built-in material ids, added to the project when used (commands.ts withMaterials).
- Material ids in finishes and layers are not all counted as uses when deleting materials (F-0058 checks rooms' finishes and floor layers: counted).

## Depends on / used by
- uses: app/document (LevelId type), core/vector (type)
- used by: room/commands, derive, fields, panel; elements/kinds/room.ts, floor.ts; app/keep-rooms, room-ui, room-tag; io/project-file

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html : `as const` makes array literals readonly tuples of literal types (lines 12-13, 38-39)
