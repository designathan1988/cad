# src/elements/kinds/zone.ts
Lines: 101
Summary: Zones (rooms taken together) in the registry: validation, derivation from its enclosed rooms (outlines, summed area, a tag under its first room's name), picked by its tag only, going with its rooms, plan (a tint of its colour over its rooms and its name · area), fields (name, category with its colour, rooms count, area); dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: derived from its rooms; a tint under everything; picked by its tag so a click on a room takes the room
- 5-14 imports: isObject, Point2, name/t, areaText, ElementKind, isColor, updateZones, zone schema, RoomSolid, trace
- 16-22 ZoneSolid: zone, outlines, area, tag position
- 24-25 TAG 0.35 m (the tag's hit half-size in metres, while its text is a fixed 11 px)
- 27-37 the kind: key, prefix, category rooms, layer under, icon, titles, dropped, exportName/exportColour (F-0047)
- 38-47 valid: name, a known category, a colour, a list of room ids
- 48-53 derive: its enclosed rooms; none → null (the zone is then not shown nor selectable, yet stays in the document: no holders, so deleting its rooms leaves an invisible zone nobody can pick to delete: F-0056)
- 54-61 element, outlines, hit near the tag, picked after walls, moved/mapped do nothing of their own (it goes with its rooms), similar by category
- 62-79 plan: each room outline filled with the zone colour at 18 % (35 % selected); the tag "name · area" in a hard-coded 11px system-ui font (not the plan's font tokens)
- 80-98 fields: name (one), category (brings its colour), rooms count, total area
- 99 the kind's closing brace

## Contracts, state and data flow
- A zone's link to its rooms is user-made (made from selected rooms) and shown by the tint.

## Depends on / used by
- uses: core/guards.ts, ui/i18n.ts, ui/units.ts, elements/material/schema.ts, elements/zone/*, elements/room/derive.ts (type), elements/kinds/paint.ts
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0056 a zone whose rooms are all gone stays, invisible and unselectable
- F-0047 (export members)

## To check in other files
- elements/registry.ts and elements/zone/commands.ts: whether deleting a room removes it from zones

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font : CSS font shorthand, default 10px sans-serif, invalid strings ignored (line 73)
