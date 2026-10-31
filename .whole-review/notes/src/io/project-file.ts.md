# src/io/project-file.ts
Lines: 449
Summary: The project file format (version 68). Writing gives the Doc as JSON with the removed areas' fields put back at the top. Reading parses, refuses non-projects and newer versions, migrates older versions (wall types, materials and patterns, library definitions redrawn, own values, groups off joints, openings linked to others by the tool held by their walls), checks every element alone (dropping or fixing and reporting it), and carries the removed areas' fields untouched in Doc.kept.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: JSON with its version; each element checked alone (dropped or fixed, reported); older files migrated, newer refused
- 6-19 imports: Point2, MIN_WALL_LENGTH, library sets (wall types, families, sectors, before 65/66), layer-set guards, isVariableName, opening style guards, library definitions
- 20-35 migration helpers for library definitions: rounded edges (v46), furniture wood (v47), the old chair, handles (v49), the old tree and potted plant (v45)
- 36-55 more imports: lights, definitionMaterials, isDefinition, layerThicknessOk (layers/stack.ts, F-0136), objectKind, units, materials, patterns, physics, Doc/KEPT_FIELDS/ownValuesOnly, contract types, KINDS, typedIds, isSavedView, deriveGeometry, distributeOpenings and wallRule (opening/commands), opening/wall types, isDrawingSettings
- 57-120 the version history (1 to 43, then 67 and 68; versions 44-66 described only where they migrate) and CURRENT_VERSION 68 (68: openings measured from or aligned with another, as the tool made them, held by their wall: F-0068)
- 122-130 keptOf (the removed areas' fields carried raw) and withoutServices (layer sets lose the 'services' category)
- 132-145 ReadError, Fix kinds (dropped per list and per registry kind, moved to the first level, typed ids), ReadResult
- 147-158 finite, isObject, isPoint, isLevel (positive height, optional cut height)
- 160-167 isTop: level/fixed/toLevel/roof rules
- 169-173 withBuiltInPattern: built-in materials of older files get their pattern
- 175-190 isMaterial: id, name, colour, roughness and metalness 0-1, cut pattern, pattern, physics
- 192-200 isWallType: layers each with a thickness layerThicknessOk accepts (the one usable-stack rule, F-0136) and a string function (not checked against the five functions; materialId not checked: F-0096), top, base offset
- 202-213 isWall: points, length ≥ MIN_WALL_LENGTH, type id, bulge, top, base offset, phase, joins (levelId not checked: moved to the first level later)
- 215-252 isRule, isSpacing, isOpeningGroup, isOpening (size, sill, hinge, swing, rule, style for its kind)
- 254-258 writeProject: Doc without `kept`, the kept fields spread back at the top, the version
- 260-268 readProject: JSON parse (notJson) then repair
- 270-288 repairProject: not a project, newer version, levels, wall types (v57 adds the more types), at least one of each; keep() filters a list and records a fix
- 289-299 walls (on a missing level → first level, said); own values only (v3)
- 300-310 openings; materials (patterns by version 30/59, built-ins when the file has none, one per layer material id); units fixed when invalid
- 311-352 definitions: the library for files before them, then each version's additions and redraws (29, 44-49, 50+ batches, 60-64 sectors, 65, 66); materials they use added
- 353-359 wall and opening ids; ids of valid registry elements (what one may be held by); kept fields
- 360-394 the doc: version, kept, drawing settings, layer sets, overrides, room overrides, variables, name, units, levels, materials, definitions, wall types, walls, openings, groups, views on existing levels
- 395-412 the registry kinds: each list checked by its kind; kept when on an existing level (axes on every level) and every holder exists (walls, openings or registry elements of the file); dropped ones counted
- 413-418 objects whose definition is missing dropped and said
- 419-423 typed ids (every id with its kind's prefix, references renamed); regroupOffJoints, then heldByWalls; the result with fixes
- 425-433 heldByWalls: for files before version 68, every opening measured from or aligned with another gets wallRule (fromStart/fromEnd from its nearer end), each worked out on the file as read so none moves; groups kept (F-0068)
- 435-448 regroupOffJoints: for files before version 4, groups with a member on a joint distributed again by stretch

## Contracts, state and data flow
- Reading never throws on bad elements: drops or fixes and reports them. A newer version is refused whole.
- The removed areas' fields round-trip raw through Doc.kept (keptOf, writeProject). Opening rules are read as stored; no station migration exists yet (F-0068 Also).
- Openings are not dropped when their wall is missing (F-0096). Layer functions and material ids are not checked (F-0096).

## Depends on / used by
- uses: core (vector, tolerance, measure), elements (wall library types, object library sets and guards, opening style, materials, patterns, physics, contract, registry, opening commands, drawing schema), app (document, layer-sets, saved-views, geometry), io/typed-ids, ui/units
- used by: app/app-files.ts (open/save), app/projects.ts and persist (stored projects), io/library-file.ts (isMaterial), tests (round trip, kept fields)

## Problems found (finding IDs)
- F-0096 (S4): unchecked layer functions and materials; orphan openings kept; history comment gap
- F-0068 (Also): no rule-to-station migration

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse : SyntaxError on invalid JSON; "__proto__" in JSON text is an own property (lines 256-264)
