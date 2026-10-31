# src/elements/room/derive.ts
Lines: 251
Summary: Rooms and floors as built. A room is the hole of the level's wall-piece union (polyclip-ts) holding its point, or "not enclosed". The file also has the label point (polylabel-style), cutting holes out of a floor outline, the middle of what is left of a space, the spaces of a level, deriving every room (with "shared space" warnings), deriving a floor (outline, holes, area, heights, slope) and the rise of a sloped floor at a point.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: a room is the empty space around its point bounded by the level's walls, taken before openings are cut; outside or inside a wall is not enclosed (as Revit)
- 6-9 imports: polyclip-ts difference, setPrecision, union; Point2; room schema types; Material
- 11-25 RoomSolid: room, enclosed, ccw outline or [], area, perimeter, label point, rooms sharing the same space
- 27-39 FloorSolid: floor, outline, area, bottom, top, holes wound against the outline, optional rise of a sloped slab, layer materials
- 41-44 RoomWarning: not enclosed, shared
- 46-56 Ring type; signedArea by the shoelace sum
- 58-62 perimeterOf: sum of edge lengths
- 64-72 insideRing: even-odd crossing test
- 74-81 toRing / fromRing (drops polyclip's repeated closing point)
- 83-85 setPrecision(1e-9) at import: polyclip's precision is one module-level setting, so this changes it for every user of the library
- 87 cache of holes by key
- 89-143 labelPoint: bounding box, cells of the shorter side, distance to the nearest edge (negative outside), the centroid first (so a rectangle keeps its middle), then refine the cell with the largest bound (linear search and splice) to 5 mm
- 145-164 cutOut: outline with holes minus cuts (stair wells); the largest part; ccw outline, cw holes
- 166-179 SLIVER 0.05 m²; middleOfRest: label point of the largest part of a space not taken by other rooms
- 181-182 spacesOf: holes of the union, ccw
- 184-195 holesOf: union of the pieces, the holes of each polygon (islands dropped: F-0073); cache keyed by the JSON of all pieces (F-0074), cleared past 64
- 197-229 deriveRooms: per room the smallest hole holding its seed, else not enclosed; outline ccw, area, perimeter, label; rooms keyed by level + JSON of the hole; shared spaces warned
- 231-247 deriveFloor: outline from its room or its own points (ccw), top from level elevation plus offset, holes cw, area less holes (≥ 0), rise from the slope (grade %, direction) above the lowest corner
- 249-250 riseAt: k · (p·u − base)

## Contracts, state and data flow
- Pure except the module cache and the global polyclip precision.
- Rooms bound by walls only. Islands inside a space are not subtracted (F-0073), and a door does not open a room.
- Called on every dispatch through keepRooms and geometry (F-0008), so its cost matters (F-0074).

## Depends on / used by
- uses: polyclip-ts, core/vector (type), room/schema, material/schema (type)
- used by: app/geometry.ts (rooms and floors), app/keep-rooms (middleOfRest, spacesOf), opening/sides.ts and fields.ts (RoomSolid), elements/kinds/room.ts and floor.ts, stairs (cutOut), room tags

## Problems found (finding IDs)
- F-0073 (S3): free-standing walls inside a room counted in its area
- F-0074 (S3): pieces serialised once per room on every derive

## To check in other files
- src/app/geometry.ts: piecesByLevel arrays (identity, for F-0074's fix)

## Sources
- https://github.com/luizbarboza/polyclip-ts : union/difference return a MultiPolygon of non-overlapping polygons; outer rings ccw, inner cw; rings self-closing (lines 79, 155, 191). setPrecision is not documented there; node_modules/polyclip-ts/dist/esm/index.js:1130 shows it sets one shared precision object
- https://en.wikipedia.org/wiki/Shoelace_formula : signed area and orientation (lines 48-56)
- https://en.wikipedia.org/wiki/Point_in_polygon : the even-odd test (lines 64-72)
