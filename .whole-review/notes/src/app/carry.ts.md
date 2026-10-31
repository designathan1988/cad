# src/app/carry.ts
Lines: 101
Summary: Rooms and their walls: which walls close a room in, which rooms go along with a move or turn of all their walls, moving room points, a per-document geometry cache, and keepRooms: after any wall change, a room that was on its own and lost that gets a new point in what is left of its space.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: rooms go with their walls when a move takes every wall around them; else stay, unless a wall moved past the point (keepRooms)
- 6-12 imports (Point2, insideRing/middleOfRest/RoomSolid, Room, Doc, deriveGeometry/DerivedGeometry); NEAR 1e-6 m
- 14-21 toSegment: point–segment distance (clamped projection; a zero-length segment → distance to its point)
- 23-36 wallsAround(g, room): the room's enclosed solid; every wall of its level with a piece edge within 1e-6 m of an outline vertex; none for an open room (cost: walls × pieces × edges × outline vertices)
- 38-48 roomsGoingWith(doc, before, moved): rooms with at least one surrounding wall and all of them in `moved` (the empty case excluded explicitly; every() alone would be true)
- 50-56 moveRooms (seed points of `going` transformed), carriedRooms (both together)
- 58-66 geometryOf: WeakMap cache Doc → DerivedGeometry (documents are immutable, so identity is a version)
- 68 alone(s): enclosed and sharing its space with no other room
- 70-100 keepRooms(from, to): `lost` = rooms of `to` that were alone in from's geometry (looked up by id) and are not alone in to's; for each, its old label point if no enclosed room of its level now covers it, else the middle of the part of its old outline no room has (middleOfRest); rooms reseeded there are tried together; only those alone at their new point keep it (all → tried; some → reseeded again with those); else `to` unchanged. Returns the document and its geometry

## Contracts, state and data flow
- keepRooms compares rooms of two documents BY ID: meaningful when `to` is an edit of `from`. Called by the store wrapper on every command that changes the walls array (app.ts:269) and by refresh for previews (app.ts:447, 475), so also when `to` is a different project opened over `from` (F-0006): a room id present in both (the same project opened again, a copy) that was alone in the old one and is not in the opened one gets its point moved: the opened file is changed silently.
- It changes the document beyond what the command did (room points), with no link the user made: part of the goal's root cause 2 for rooms (moving a wall moves a room's point; "mover a porta sem mexer nos cômodos").
- The result is cached per document (WeakMap), so repeated calls in a drag are cheap only while the same `to` object is passed.

## Depends on / used by
- uses: elements/room/derive.ts (insideRing, middleOfRest, RoomSolid), app/geometry.ts (deriveGeometry)
- used by: app/app.ts (store wrapper, refresh: keepRooms, moveRooms, geometryOf), app/select-drag.ts (roomsGoingWith), tools/transform.ts (carriedRooms? to check), tests/app/carry.test.ts

## Problems found (finding IDs)
- F-0006 (proof completed here: rooms matched by id across two different projects)
- F-0008 (rooms part of the automatic follow-ups)

## To check in other files
- elements/room/derive.ts middleOfRest: what it returns when nothing is left (null)
- tools/transform.ts: use of carriedRooms

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap : keys held weakly, compared by identity (lines 59-66: a cache per immutable document version)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : every() is true for an empty array (line 44 guards it with around.length > 0)
