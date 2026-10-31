# src/app/geometry.ts
Lines: 521
Summary: The derivation of everything drawn from the document: walls joined by height slices per level (plan pieces, 3D blocks under roofs, seams, materials), openings placed and cut (with joint and swing-clash warnings), rooms from the uncut walls and separators, spaces, and the registry kinds; plus hit tests (opening, wall), bounds, temporary hide/isolate and hidden categories.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: document → derived geometry through the join engine, recomputed, never stored
- 4-27 imports: separator strip, vector, registry (deriveKinds, eachSolid, filterKinds), opening derive/symbol/void, wall footprint (computeWallGeometry), convex helpers, wall offsets, tolerances, JOINT_REACH 1 cm (declared between imports), wall shape, join warnings, wall schema types, layer seams, room derive, materials, document helpers, blocksUnder (roof)
- 29-50 PlanCut; WallSolid: wall, plan pieces with openings cut, how it shows in plan (cut/below/above at the level's cut height), 3D blocks, bottom/top, its type's layers, seams, layer materials
- 52-60 OpeningSolid: a placed opening + its frame (null without a valid host), absolute bottom/head, materials its style sets
- 62-75 DerivedGeometry: solids, join warnings, openings and their warnings, rooms and their warnings, spaces(level) found on demand, levelPieces (comment says "app/lot-areas.ts": that module was taken out, stale: F-0015), kinds
- 77-108 deriveGeometry(doc, extra walls, extra openings): wall pieces by height slices; openings placed on hosts with joints and clear ends (hostsOf); per opening: its wall's shape, absolute bottom/top from the wall's base, the frame on the shape, its style's materials; a cut for its wall unless it lies outside the wall
- 109-126 an opening over another wall's joint (another wall's pieces overlap the opening span across the host's thickness + 1 cm): invalid with 'openingAtJoint'
- 127-145 doors whose swing regions overlap on the same level: both invalid with 'openingSwingClash' (pairwise O(n²) over all openings with a swing)
- 146-148 plan pieces: each wall's pieces with its openings cut
- 149-163 seams per level among cut walls: layers keyed by function (finish2 counted as finish1) and material
- 164-176 solids: heights; the wall's slices cut by its openings in 3D; under a roof each block cut by the roof covers (wallTop kind roof); layer materials
- 177-192 rooms from the walls before openings are cut, plus separators as zero-thickness strips; deriveRooms; spaces(level) memoized per call
- 193-196 the base geometry, then the registry kinds derived from it (dimensions need walls and doors)
- 198-203 WallSlice: a height range and the wall's joined pieces there
- 205-262 wallPieces: per level, every distinct base/top height (merged within tolerance) cuts the range; each range joined with only the walls spanning it (computeWallGeometry per range); warnings deduplicated by JSON; a wall's consecutive ranges with equal pieces (JSON compared) merged; in plan the slice at the level's cut height, else the top one below or the lowest above; a wall with no height range joined alone
- 264-301 jointsIn: for each straight wall, the stations along it covered by other walls' pieces within its faces (+1 cm), kept only when strictly inside its length (a T or an X)
- 303-307 planCutHeight: level elevation + its cut height (1.2 m default)
- 309-349 endsIn: for each straight wall, how far the walls at its ends cover its length (from, to): the same band/station computation as jointsIn, copied (F-0016)
- 351-356 hostsIn: hosts for placing openings from a wall list (re-runs wallPieces: a full join of every wall)
- 358-364 openingOutline: the jambs across the wall's faces
- 366-386 a stale one-line doc comment over the real one (F-0015); openingAt(g, p, reach): last placed first, inside its outline → it; else the nearest within reach of its outline or symbol lines
- 388-402 segmentDistance (clamped projection), polylineDistance (minimum over its segments)
- 404-410 polygonDistance: 0 inside, else the nearest edge
- 412-421 insidePolygon: even-odd ray crossing (PNPOLY); the division only runs when the edge spans p.y (no division by zero); boundary points fall either way
- 423-441 wallAt: last solid first, a piece containing p; else the nearest within reach
- 443-465 boundsOf(g, ids?): the doc says "drawn pieces and openings" but it collects rooms' outlines and the registry kinds' (endless ones by their point, those with an extent by it, else outlines): walls count only if the registry derives walls as a kind (to check in registry.ts); a doubled comment line (452-453, F-0015)
- 467-473 CATEGORIES (walls, openings, rooms, floors, objects, guides) as const, the one list (browser rows, palette show/hide, layer-set check: F-0107), and Category = its element type
- 475-487 a stale doc comment ("The geometry without the hidden categories…", hideCategories's) over TemporaryView's (F-0015); TemporaryView (hide | isolate, ids); shownFor
- 489-508 applyTemporary: walls kept or not; openings: hide → shown and its wall kept, isolate → isolated itself or its wall kept; rooms by id; kinds: hide → itself and all its holders shown, isolate → itself or any holder isolated
- 510-520 hideCategories: walls/openings/rooms maps emptied by category; kinds filtered by their category (null-category kinds always kept)

## Contracts, state and data flow
- deriveGeometry is the whole derivation, run on every document change and on every pointer move while drawing/dragging/placing (refresh): full join by height slices, openings, rooms, kinds.

## Depends on / used by
- uses: elements/wall/geometry/* and join engine (computeWallGeometry), elements/opening/derive|symbol|void, elements/room/derive, elements/separator, elements/registry, app/document.ts
- used by: app/app.ts, carry.ts (geometryOf), every renderer and tool (DerivedGeometry), select-drag.ts, input.ts (wallAt, openingAt), kind-tools.ts, section-drawing.ts, tests

## Problems found (finding IDs)
- F-0015 stale comments (71: app/lot-areas.ts; 366)
- F-0016 jointsIn and endsIn copy the same band/station code

## To check in other files
- elements/opening/derive.ts hostsOf, deriveOpenings
- is levelPieces still read anywhere?

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map : new Map(map) is a shallow copy (line 185); values() in insertion order
- https://wrfranklin.org/Research/Short_Notes/pnpoly.html : PNPOLY's crossing test, the division guarded by the span test, boundary points classified either way (lines 412-421)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse : reverse mutates in place; [...values()].reverse() reverses a copy (line 375)
