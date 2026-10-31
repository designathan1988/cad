# src/io/typed-ids.ts
Lines: 47
Summary: On reading, every element id gets its kind's prefix (wall_, opening_, room_…) when it lacks one, unique against the taken ids, and references to renamed ids follow, for openings, groups, floors and dimensions only.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: ids say their kind (phase 1); untyped ones renamed with every reference; pure
- 6-10 imports: Doc, DimAnchor, opening types, GROUP_PREFIX, registry helpers
- 12-23 typedIds setup: taken ids; typed(): the id with its prefix, numbered when taken; renames keyed by the bare id (all kinds in one map: F-0097)
- 24-27 every registry element and group renamed as needed; none → the same doc
- 28-30 the lists with their new ids
- 31-44 references remapped: openings (wall, rule's opening or group), groups (id, wall, members, between), floors' rooms, dimension anchors (wall or opening); zones, hosted railings, measures and others not (F-0097)
- 45-46 the doc and the count

## Contracts, state and data flow
- Pure. Runs inside repairProject after reading (project-file.ts:415-417).

## Depends on / used by
- uses: app/document (type), dimension/schema (type), opening/schema, registry (KINDS, listOf, withList)
- used by: io/project-file.ts

## Problems found (finding IDs)
- F-0097 (S4): references of several kinds not remapped; renames keyed across kinds

## To check in other files
- src/elements/contract.ts: a references hook to drive the remap

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set : set on an existing key replaces its value (lines 15, 21: one map for all kinds)
