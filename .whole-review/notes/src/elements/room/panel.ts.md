# src/elements/room/panel.ts
Lines: 6
Summary: A type alias only: the actions the panel lends rooms and floors are RoomFieldActions (their fields are built by kinds/room.ts and kinds/floor.ts).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the actions the panel lends rooms and floors
- 3 import type: RoomFieldActions from fields.ts
- 5 RoomPanelActions: an alias of RoomFieldActions

## Contracts, state and data flow
- Types only; erased at compile time.

## Depends on / used by
- uses: room/fields (type)
- used by: ui/panel.ts:11, 71 (the panel's room actions)

## Problems found (finding IDs)
- none (a one-line alias module; it could be imported from fields.ts directly)

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/2/everyday-types.html : a type alias only names a type and emits no JavaScript (line 5)
