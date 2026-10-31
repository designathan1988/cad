# tests/io/project-file.test.ts
Lines: 320
Summary: Tests of the project file format. Behaviours covered:
- Round trip: a project written and read back is unchanged.
- Levels: the cut height reads back; isLevel refuses a 0 or string cut height.
- Version 1 migration: missing lists are filled in, and the file is read as the current version.
- Opening groups and the newer rules read back; a bad group is dropped and reported.
- Bad elements are dropped and reported. A wall on a missing level moves to the first level.
- Refusals with a reason: not JSON, not a project, no levels, no wall types, a newer version.
- Version 3: walls with no top or base and types that have them read back; a malformed top drops the wall (F-0137).
- Version 4: a group's stretch reads back; a malformed one drops the group.
- Pre-v3 walls keep only the heights that differ from their type.
- Version 5: guides.
- Library definition migrations by version (45, 46, 47, 48, before 65, before 66): built-ins as they came are redrawn; ones changed by hand are kept.
- Version 67: fields of the removed areas (services, rules, sheets, site, costs) are carried untouched through two read/write cycles and written back at the top; a layer set hiding "services" keeps its other categories.
- Version 68: an older file's opening measured from another is held by its wall in the same place; a current file keeps the user's link.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-14 imports (vitest, newDocument, CURRENT_VERSION/isLevel/readProject/writeProject, BEFORE_65, BEFORE_66) and a wall helper
- 16-22 round trip equal, no fixes
- 24-32 cutHeight 1.5 reads back; isLevel refuses 0 and '1'
- 34-52 a v1 file without openings/rooms/floors gets empty lists and the current version; a v1 without groups gets []
- 54-67 groups and inGroup/aligned rules read back; a group with members as a string is dropped (droppedGroups 1)
- 69-83 a wall with a bad start dropped (droppedWalls 1); a wall on 'nowhere' moved to lvl_ground (movedToFirstLevel)
- 85-93 refusals: notJson, notProject (array; no version), noLevels, noWallTypes, newerVersion; suite closes
- 95-112 v3: a parapet type with a fixed top and a wall without its own read back; a top {kind: 'level'} without offset drops the wall
- 114-132 v4: between [null, 'c'] reads back; a v3 group has none; malformed between values drop the group
- 134-155 pre-v3 walls: own values equal to the type are removed, a different base kept; in a v3 file too
- 157-176 (two blank lines at 156-157) v5 guides: read back; an older file has none; malformed and gone-level guides dropped in two fixes
- 178-196 v45: the library sofa gets rounded edges; a bed changed by hand is kept
- 198-220 v46: furniture gets the furniture wood; the one-board chair gets the open back; woodVeneer added
- 222-235 v48: kitchen and washbasin get handles unless changed by hand
- 237-244 v47: the point light's cylinder becomes the bulb and its socket
- 246-268 before 65: cooker redrawn, a renamed plant kept; before 66: the bookcase redrawn; suite closes
- 270-289 v67: the five area fields read from a v66 file are written back equal twice over, with no `kept` key in the output
- 291-295 a layer set hiding ['services', 'walls'] reads as ['walls']; suite closes
- 297-319 v68 (F-0068): a v67 file's window measured from the door beside it (fromOpening, 0.5 m past its end) reads as fromStart 2.5, where it was; a v68 file keeps the fromOpening the user chose; suite closes (line 320 blank)

## Contracts, state and data flow
- readProject returns {ok, doc, fixes} or {ok: false, error}. Every element is checked alone; bad elements are dropped and counted. Migrations are keyed on the version. The removed areas' fields ride in Doc.kept and are spread back at the top on writing.

## Depends on / used by
- uses: src/app/document, src/io/project-file, src/elements/object (library-before65, library-before66)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0137 (lines 106-111: a wall dropped for one malformed optional top)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse : throws SyntaxError on invalid JSON; any JSON value, arrays included, is accepted at the top (lines 86-87)
