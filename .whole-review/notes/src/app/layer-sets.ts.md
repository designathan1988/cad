# src/app/layer-sets.ts
Lines: 110
Summary: Layer combinations (named sets of hidden categories) and graphic overrides (wall types and room uses filled in a colour of their own in plan), their guards, the commands that save/delete/replace them, the colour maps the plan reads, and the walls' renovation phases.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: layer combinations and overrides, kept in the project, each change one command
- 6-10 imports: Command, isColor, Doc, CATEGORIES and Category (geometry.ts: the one list, F-0107), ROOM_USES
- 12-17 LayerSet: id, name, hidden categories
- 19-24 WallOverride: id, wall type id, #rrggbb colour
- 26-32 RoomOverride: id, room use, #rrggbb colour drawn translucent
- 34-37 isRoomOverride: id and use strings, use one of ROOM_USES, valid colour
- 39-48 setRoomOverrides: invalid list or same JSON → unchanged; empty list removes the field; else replaces
- 50-51 roomOverrideColours: use → colour map (a repeated use: the last wins, Map constructor)
- 53-60 wallPhases: when any wall has a phase, every wall's phase (default new); else an empty map
- 62 isCategoryList: an array whose every entry is one of CATEGORIES
- 64-67 isLayerSet: id string, non-blank name, valid hidden list
- 69-72 isWallOverride: id and wall type id strings, valid colour
- 74-78 nextName: the first free "base n" from 1
- 80-83 saveLayerSet: appends a valid set (no check of a repeated id or name)
- 85-95 deleteLayerSet: removes by id; an empty list removes the field
- 97-106 setOverrides: as setRoomOverrides for wall overrides
- 108-109 overrideColours: wall type id → colour map

## Contracts, state and data flow
- Pure commands over Doc; the guards are the file reader's checks too (project-file.ts).
- A layer set saved before the cut with 'services' is cleaned by project-file.ts withoutServices before isCategoryList sees it.
- The categories a set can hide are geometry.ts's CATEGORIES, the list Category is made from: a new category is in both at once (F-0107 fixed).

## Depends on / used by
- uses: core/store.ts (Command), elements/material/schema.ts (isColor), elements/room/schema.ts (ROOM_USES), app/geometry.ts (CATEGORIES, Category)
- used by: io/project-file.ts (guards), render/plan-view.ts (colour maps, phases), ui/layers dialog and app/views-ui.ts

## Problems found (finding IDs)
- none (F-0107 fixed: its own copy of the categories removed)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/Map : new Map(entries) sets each in order, a repeated key keeps the last value (lines 51, 109)
- https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html : (typeof list)[number] gives the type of a list's elements (Category from CATEGORIES)
