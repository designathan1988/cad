# src/elements/kinds/room.ts
Lines: 96
Summary: Rooms in the registry: their outline read from the base geometry (derived from the level's walls), warnings (not enclosed, sharing its space), validation, selection inside an enclosed outline (last), moving/mapping/transforming the seed point, copies numbered on, plan highlight when selected, fields; dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: outline from the whole level's walls (deriveRooms in the base geometry)
- 4-11 imports: guards, Point2, name/t, ElementKind, updateRooms, insideRing/RoomSolid, roomFields, Room/ROOM_USES
- 13 ROOM_PREFIX 'room' (defined here, not in room/schema.ts as other kinds' prefixes are)
- 15-16 RoomItem: the solid at its level's floor
- 18-20 nextNumber: the highest numeric number on the level + 1 (String of the integer) — the rule the room tool should use (room-ui.ts uses count + 1: F-0035)
- 22-31 the kind: key, prefix, category rooms, layer under, icon, titles with its name
- 32-42 warning for one room: not enclosed, or sharing its space with others (their number · name)
- 43-45 dropped, exportName/exportColour (F-0047)
- 46-55 valid: seed point, name and number strings, a known use, height > 0, base finish ≥ 0
- 56-60 derive: the base geometry's room (or a not-enclosed stand-in) at its level's floor
- 61-67 element, outlines (only enclosed), hit inside, picked last, moved/mapped move the seed
- 68-72 transformed (selected or going with all its walls), copied (numbered on), similar (same use; a room without a use is like all)
- 73-85 plan: only a selected enclosed room is filled (its tag is drawn by the plan)
- 86 span: zero height at the floor
- 87-95 fields: roomFields (one or several), level height, materials, interior elevations

## Contracts, state and data flow
- A room is a seed point; its outline follows the walls on every change (keepRooms in the store wrapper also moves seeds: F-0008).

## Depends on / used by
- uses: core/guards.ts, ui/i18n.ts, elements/room/*
- used by: elements/registry.ts; app/room-ui.ts (via the store)

## Problems found (finding IDs)
- F-0035 (contrast: nextNumber here is correct; the room tool does not use it)
- F-0047 (export members)

## To check in other files
- app/carry.ts keepRooms (moves seeds on every change)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String : String(x) coerces to a string primitive (line 20)
