# src/elements/stair/commands.ts
Lines: 40
Summary: Commands on stairs and ramps: add one, and update several. An update can change kind, width, tread, turn, height, railing, ramp grade, well, split and winders.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc, Command, Stair and StairKind types
- 7-10 addStair: appends a stair or ramp to the document
- 12-23 StairPatch: kind, width, tread, turn side, height, railing, grade, well, split, winders
- 25-39 updateStairs: width, tread, height, grade and split must be finite and above 0 (no upper bounds, and split is not checked against its own range); merge; JSON comparison; one step

## Contracts, state and data flow
- Pure. Ranges beyond "> 0" are left to the fields and to the stair geometry (stair/geometry clamps or warns: see that file).

## Depends on / used by
- uses: app/document (type), core/store (type), stair/schema (types)
- used by: the stair tool (addStair), stair fields/panel (updateStairs), presets

## Problems found (finding IDs)
- none here (limits to be checked in stair/schema.ts and geometry)

## To check in other files
- src/elements/stair/schema.ts: what `split` means and its valid range

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some : stops at the first truthy result; false on an empty array (line 28)
