# src/app/room-tag.ts
Lines: 24
Summary: The text of a room's tag in plan by the drawing's choice: number and name (default), name, number, or number and name with the ceiling height; its area line except for the number alone; and the short form (the number) for narrow rooms.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: what a room's tag says, by the drawing's roomTag setting
- 5-8 imports: RoomTagContent, Room, name/t, areaText/lengthText
- 10-23 roomTagText: "number · name" (an empty number gives " · name"); name → name + area; number → number, no area; numberNameHeight → both + area · height (the room's own or the level's); default (numberName or any unknown value, strict match) → both + area

## Contracts, state and data flow
- Pure; the content value comes from the drawing settings (elements/drawing/schema.ts).

## Depends on / used by
- uses: elements/drawing/schema.ts (type), elements/room/schema.ts (type), ui/i18n.ts (name, t), ui/units.ts
- used by: render/plan-view.ts (room tags), app/frame.ts: to confirm

## Problems found (finding IDs)
- none

## To check in other files
- whether a room's number can be empty (then the tag starts with " · ")

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/switch : cases compared with ===, default when none matches (lines 13-22)
