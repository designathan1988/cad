# src/elements/room/commands.ts
Lines: 148
Summary: Commands on rooms and floors (floors, slabs and ceilings). They add a room, update rooms (name, number, use, own height, finishes), add a floor, update a floor's thickness, offset and slope, set build-up layers (adding missing materials), set or clear the tiling, add a hole, and clear holes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-7 imports: materialFor, stackProblem (layers/stack.ts), Doc, Command, room schema types
- 9-12 addRoom: appends a room to the document's list
- 14-15 RoomPatch: name, number, use or null, height or null, finishes per key (null removes)
- 17-18 updateRoom: one id through updateRooms
- 20-53 updateRooms: refuse a blank name or a height not above 0; per room: use and height set or removed with null; finishes merged (null or '' deletes; a skirting not above 0 is none); name trimmed; JSON comparison; one step
- 55-58 addFloor: label by kind (ceiling or floor)
- 60-76 updateFloor: thickness > 0, finite offset; slope merged unchecked (a non-finite grade would reach riseAt)
- 78-82 withMaterials: built-in materials added for layer ids the project lacks
- 84-104 setFloorLayers: a stack stackProblem refuses (none, or a thickness not finite and above zero) changes nothing (F-0136: Infinity no longer passes); else thickness = their sum; or none (the slab's thickness kept); materials added
- 106-122 setFloorTiling: pieces > 0, joint ≥ 0, finite angle; or plain
- 124-131 addFloorHole: three points or more, copied
- 133-147 clearFloorHoles: removes holes from the given floors; same doc when none has holes

## Contracts, state and data flow
- Pure; no undo step when nothing changes. Floors from rooms derive their outline from the room (room/derive.ts deriveFloor).
- The build-up follows the one usable-stack rule (layers/stack.ts), the same the floor's check on reading uses (F-0136). Other values checked here are minimal: Infinity passes `> 0` for a room's height and a floor's own thickness, and a slope is not checked at all.

## Depends on / used by
- uses: material/schema (materialFor), layers/stack (stackProblem), app/document (type), core/store (type), room/schema (types)
- used by: room and floor tools and panels (room/fields.ts, app/room-ui.ts), keep-rooms (addRoom), stair tool (floor holes)

## Problems found (finding IDs)
- F-0136 fixed (setFloorLayers checks the stack as layers/stack.ts does)

## To check in other files
- src/elements/room/fields.ts: slope field limits

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete : delete removes an own property and returns true (line 36)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : Infinity is not finite while Infinity > 0 is true (why setFloorLayers now uses stackProblem, line 92)
