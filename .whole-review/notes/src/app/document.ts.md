# src/app/document.ts
Lines: 365
Summary: The project document type (Doc v68: F-0068's migration) and its levels and walls; the default storey height and the stand-in for a level that is gone (LEVEL_HEIGHT, NO_LEVEL); the fields kept for the areas taken out (KEPT_FIELDS, Doc.kept); a new document's defaults; and the derived helpers every module uses: level lookup, start level, wall numbers, a wall's top/base (own or its type's), its heights (level, fixed, to a level, under a roof), roof covers per level (cached), a wall's band, its thickness, and the drawing settings.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: only what the user decided; thickness, heights, joins and geometry derived
- 4-35 imports: MIN_ELEMENT_SIZE, the extra wall types, layer set/override types, every element schema type, drawing defaults, the object library, units, materials, registry (KINDS, listOf), saved views, Point2, wall schema types, under-roof (highestUnder, roofCovers), roofSolid, toCounterClockwise
- 37-52 LevelId, Level (id, name, elevation, floor-to-floor height, cutHeight?), CUT_HEIGHT 1.2 m, cutHeightOf
- 54-57 LEVEL_HEIGHT 2.8 m (a new project's level, a fixed top's first height, the scene's least height) and NO_LEVEL { elevation 0, height LEVEL_HEIGHT } (what an element on a level that is gone stands on): the one place for both (F-0139)
- 59-64 two doc comments in a row: the first ("A wall as the user placed it…") belongs to DocWall at 66 but sits over WallPhase (stale placement: F-0012); WallPhase existing | demolish
- 66-72 DocWall: the engine's Wall + level, phase?, baseOffset?, top? (own only when different from the type's)
- 74-144 Doc v68: name, units, levels, materials, wall types, walls, openings ("placed by a rule": the goal's root cause 2), opening groups, rooms, floors, guides, views, notes, dimensions, grids, columns, beams, roofs, stairs, railings, definitions, objects, separators, measures, curtains, zones, sections, references; optional drawing, variables, layer sets, overrides, room overrides; kept (the removed areas' fields, as read)
- 146-163 KEPT_FIELDS: the 15 field names carried in kept
- 165-171 WallDefaults: the wall tool's next wall (type, reference line, base offset, top), interface state
- 173-175 elementIds: ids of every registry kind's elements (a Set built from every list)
- 177-239 newDocument: version 68, ground level at 0 m, LEVEL_HEIGHT; built-in materials; four basic wall types + the library's; empty lists; the object library's definitions
- 241 levelOf: the level with that id, or undefined
- 243-253 a stray doc comment ("A wall's number on its level…", it belongs to wallNumber at 255) over startLevel's own (F-0012); startLevel: the last shown if it exists, else the lowest level with walls, rooms or floors, else the lowest
- 255-259 wallNumber: 1-based position among the walls of its level in document order (null when absent)
- 261-267 LEVEL_TOP; typeOf; wallTop (own ?? type's ?? level+0); wallBase (own ?? type's ?? 0)
- 269-279 ownValuesOnly: drops top/baseOffset that equal the type's (compared by JSON.stringify, key-order sensitive)
- 281-289 wallOverrides: which of top/base differ from the type's (JSON compare)
- 291-316 wallHeights: its level, or NO_LEVEL when gone; bottom = level elevation + base; top by kind: level (+offset), fixed (bottom + height), toLevel (the other level's elevation + offset, else its own level top), roof (highest underside over the wall's band, else level top); never less than MIN_ELEMENT_SIZE above the bottom
- 318-336 roofCoversOf: the level's (or NO_LEVEL's) roofs as covers, cached in a WeakMap by Roof object together with the level top they were worked out at; a different top recomputes (F-0013 fixed)
- 338-356 wallBand: the wall's line widened by its thickness (≥ 1 cm) on both sides and past both ends, counter-clockwise
- 358-359 wallThickness: the sum of its type's layers (0 for an unknown type)
- 361-364 re-export of Point2; drawingOf (the project's or the defaults)

## Contracts, state and data flow
- Documents are immutable values; caches keyed by object identity (covers) are valid only when every input is in the key.
- JSON.stringify comparisons (276, 286) depend on key insertion order: equal tops built in different orders compare different (a top written { offset, kind } vs { kind, offset } would be kept as an own value).
- LEVEL_HEIGHT and NO_LEVEL are read by the element kinds (beam, column, curtain, roof, stair), the stair well, frame, view-ui, next-element, room-ui, app (height), the wall and wall type fields (F-0139). The elevation fallback `?.elevation ?? 0` elsewhere is the same value as NO_LEVEL.elevation.

## Depends on / used by
- uses: core/tolerance.ts, elements/* schemas, elements/registry.ts, elements/wall/geometry/under-roof.ts, elements/roof/geometry.ts, elements/wall/geometry/convex.ts, ui/units.ts
- used by: nearly every module (Doc type, levelOf, LEVEL_HEIGHT, NO_LEVEL, wallHeights, wallThickness, drawingOf, newDocument, startLevel, wallNumber, KEPT_FIELDS in io/project-file.ts)

## Problems found (finding IDs)
- F-0012 two misplaced doc comments (59-63, 243-247)
- F-0013 fixed (the cache keeps the level top with each cover)
- F-0139 fixed (the 2.8 m default and the missing level's stand-in named here once)

## To check in other files
- elements/wall/geometry/under-roof.ts roofCovers/highestUnder; elements/roof/geometry.ts roofSolid(r, base)
- elements/level/commands.ts: does changing a level's height/elevation replace the roofs on it (new objects would refresh the cache)?

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : properties in Object.keys order, so equal objects with keys in other orders stringify differently (lines 276, 286)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap : an identity-keyed cache is valid only when all inputs are captured by the key (lines 319-329)
- https://en.wikipedia.org/wiki/Magic_number_(programming) : a named constant in one place instead of a literal repeated (LEVEL_HEIGHT, NO_LEVEL, F-0139)
