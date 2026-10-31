# tests/tools/transform.test.ts
Lines: 182
Summary: Tests of moving, turning, scaling and mirroring a selection, in place and as copies, worked by hand on a 4 × 3 box with a wall x going on from its corner, a door on the bottom wall and a room with its floor.
- In place:
  - Moved: the room comes along, and the unselected wall joined at the corner keeps its join.
  - Rotated a quarter about the origin.
  - Scaled ×2: lengths and the door's distance double; the door's width and the wall type do not change.
- Mirrored copy: the wall is reflected and its ends swapped. Its door is measured from the other end, hinged at the other jamb and opens to the mirrored side. The original stays.
- Copied box: four new walls, the room numbered on (2), the floor following the new room, and the room enclosed.
- canTransform takes walls, openings, rooms, outline floors and guides; a floor made from a room is refused alone.
- Door without its wall: moved, it slides on its wall; moved onto another wall, it is rehosted with the side its middle landed on; copied, a new door is made, and no copy is made where there is no wall.
- Copy to another level: the box, its door and its room are copied to the same place, the room numbered first on that level; a door alone is left out.
- Copies in series: "3x" puts boxes at 5, 10 and 15 m with the last one selected; "/2" puts boxes at 2.5 and 5 m.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the scene worked by hand
- 5-9 imports: vitest, document, geometry, newOpening, the transform functions
- 11-30 wall helper; the doc (box, x, door, room, floor); its geometry; box ids; a module-level id counter shared by every test; find()
- 32-41 translation (1, 0): b from 1 to 5; x's start follows to 5; the room seed moves; the door rule unchanged; selection unchanged
- 43-50 rotation π/2: b's end at (0, 4); the seed at (−1.5, 2)
- 52-58 scaling ×2: b to 8; door fromStart 2, width 0.9; type kept; suite closes
- 60-71 reflection about x = −1, copy: (−6, 0)–(−2, 0) (ends swapped); the copy selected; b unchanged
- 73-83 the copied door: fromEnd 1, hinge end, swing left, its jambs at −3.9 and −3; suite closes
- 85-95 the box copied 6 m up: 9 walls; the room numbered 2 at (2, 7.5); the floor on the new room; enclosed
- 97-104 canTransform: wall, room, opening true; a room floor false
- 106-116 door moved 1 m along b: start 1 → 2, walls unchanged, selection kept
- 118-125 door moved onto r: rehosted on r, middle at 1.5
- 127-137 door copied 1 m: two doors, the copy at 2 and selected; copied onto nothing: no copy; suite closes
- 139-156 copyToLevel: four walls on lvl_up at the same ends; originals equal; the door on the copied b; the room on lvl_up numbered 1 and enclosed
- 158-162 a door alone: not copied; suite closes
- 164-174 3x (5, 0): 12 new walls; bottoms at 5, 10, 15; the last four selected; 4 doors; seeds 2, 7, 12, 17
- 176-181 /2: bottoms at 2.5 and 5; suite closes (line 182 blank)

## Contracts, state and data flow
- transformSelection maps the selected elements by an affine transform and, for copies, gives them new ids. A reflection reverses orientation, so wall ends are swapped and opening rules, hinges and swings are remapped (another rule-kind rewriter: F-0068 Also). End joins and dimensions are not swapped (F-0087 Also). Wall ends not selected but joined follow, as in edit.ts.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening/schema, src/tools/transform
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (mirror and per-end data: F-0087 Also; rule rewriting: F-0068 Also)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Affine_transformation : affine maps keep lines, parallels and ratios along a line; a reflection has determinant −1 and reverses orientation (lines 52-83)
