# tests/elements/room/commands.test.ts
Lines: 66
Summary: Tests of room and floor commands. Each command is one undo step. Adding and editing a room works. A use and an own height can be set on several rooms at once; null removes them; a height of 0 is refused. Use and height survive a file round trip. In a file, an unknown use or a zero height drops the whole room, with a droppedRooms fix (F-0137). A blank room name is refused with no undo step. A floor is added, its thickness and offset set, and a zero thickness refused.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 imports: vitest, document, store, vec, room commands (addFloor, addRoom, updateFloor, updateRoom, updateRooms), project file
- 8-9 a room seeded at (4, 3) and a 15 cm floor made from it
- 11-19 add, then rename and renumber; undo brings back 'Room 1'
- 21-38 use bedroom and height 2.6 on two rooms in one step; null removes both from q; height 0 refused; two undos clear them
- 40-49 round trip keeps use and height; 'ballroom' or height 0 empties rooms and reports droppedRooms (the whole room lost for one optional field: F-0137)
- 51-55 a blank name: canUndo false
- 57-65 addFloor, updateFloor thickness 0.2 and offset −0.05; thickness 0 refused; suite closes (line 66 blank)

## Contracts, state and data flow
- Commands refuse bad values by returning the same document. On reading, an element that fails its kind's valid is dropped and counted.

## Depends on / used by
- uses: src/app/document, src/core/store, src/core/vector, src/elements/room/commands, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0137 (lines 44-48 pin the whole-room drop)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Robustness_principle : be liberal in what you accept when the meaning is clear, and its criticism (lines 44-48: a known room with one unknown optional value)
