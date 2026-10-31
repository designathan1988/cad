# tests/tools/wall-type-keep.test.ts
Lines: 109
Summary: Tests that changing a wall's type keeps the room's clear size (phase 11, differential 3). The face against the room stays where it was and the thickness goes to the other side. Between two rooms the middle stays and both rooms share the change. With no room, or with the option off, the reference line stays. Cases:
- a room's walls changed from 15 to 20 cm keep the room's area, with the walls growing outwards;
- with the option off, the line stays and the room shrinks;
- one wall changed alone moves only itself, and its neighbours' joins follow without warnings;
- a partition drawn on its exterior face between two rooms keeps its middle, each room gaining 5 cm × 3.85 m;
- a lone wall keeps its line;
- an arc round a half-round room changes its radius so the inner face stays.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: what stays (the room face, the middle, or the line)
- 5-10 imports: vitest, document, geometry, insideRing, ReferenceLine, changeWallType/roomFace
- 12-21 wall helper with a type and a reference line
- 23-27 a 6 × 4 box of 15 cm walls and its room
- 29-37 inRoomOf (enclosed rooms by level), areas, keepRoom (roomFace with that test)
- 39-48 15 → 20 cm on all four: type changed, area 5.85 × 3.85 kept, the south line moved to −0.025
- 50-54 option off: the line at y 0, area 5.8 × 3.8
- 56-62 only s changed: area kept, no warnings, e's start follows to −0.025
- 64-88 an 8 × 4 box with a 20 cm partition on its exterior face: roomFace 'middle'; to drywall 10, each room gains 0.05 × 3.85
- 90-94 a lone wall: roomFace null, start unchanged
- 96-108 a half-round room: the arc's roomFace is not null; area kept to 3 digits after 15 → 20 cm; suite closes (line 108; 109 blank)

## Contracts, state and data flow
- changeWallType takes a function that says which face to keep (room side, middle, or null) and moves each wall's line by the change in offset of that face; joined ends follow. Clear (net) area is measured to the inner faces, so keeping those faces keeps the room's area.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/room/derive, src/elements/wall/schema, src/tools/edit
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Floor_area : net area is measured to the internal faces of the walls, gross to the external faces (lines 39-48, 64-88)
