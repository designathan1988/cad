# tests/elements/wall/join-overrides.test.ts
Lines: 122
Summary: Tests of the user's join choice at a wall end (schema EndJoin; spec §2.1; Revit's Wall Joins / Disallow Join). The setup is an L of two 20 cm walls worked by hand; the cases:
- automatic between walls of the same type is a miter;
- 'through' gives a the corner square; 'stop' gives it to b, which equals b choosing 'through';
- both walls 'through' cancel out to automatic;
- 'off' leaves both ends square at the corner point: the outer corner open, the inner covered twice;
- 'square' at 90° equals the butt; at 120° a goes on and ends square to its own line at the farther of its faces on b's outer face;
- between different types the automatic join is a butt (the thicker core goes through), and 'miter' forces the diagonal;
- every choice survives a file round trip; an unknown one drops the whole wall with droppedWalls (F-0137 Also).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the L worked by hand: bands, corner square, outer and inner corners
- 6-11 imports: vitest, computeWallGeometry, EndJoin/Wall/WallType, Point2, newDocument, project file
- 13-23 two types: solid 20 cm; layered 2+16+2 cm; their map
- 25-28 L(aJoin, bJoin, bType): walls a (along x) and b (along y) with optional start joins
- 30-39 covers(): a point strictly inside one of a wall's convex counter-clockwise pieces (every edge cross product > 1e-9)
- 41-49 points below and above the diagonal; automatic: a below, b above
- 51-61 'through': a covers both, b only from y 0.1; 'stop': b covers both, a only from x 0.1
- 63-70 b 'through' equals a 'stop' (equal pieces); both 'through' equals automatic
- 72-78 'off': outer corner covered by neither, inner by both
- 80-84 'square' at 90°: a's equals 'through', b's equals 'stop'
- 86-102 'square' at 120°: a covers (−0.17, −0.09) where 'through' does not, not (−0.18, 0.09); the shared point is a's; b covers its own beyond
- 104-110 solid with layered: automatic gives a the corner; 'miter' gives the diagonal
- 112-121 five choices read back in order; 'bevel' empties walls and reports droppedWalls; suite closes (line 122 blank)

## Contracts, state and data flow
- A join choice is stored per wall end (joins.start / joins.end) and read by the join engine at that node. Equal requests from both sides cancel to automatic. File reading validates the choice as part of the wall, so an unknown choice drops the wall.

## Depends on / used by
- uses: src/elements/wall/geometry/footprint, src/elements/wall/schema, src/core/vector, src/app/document, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0137 (Also: lines 117-119 drop a whole wall for one unknown optional join)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Curve_orientation : the sign of (B−A)×(C−A) tells whether C is left of A→B; positive means counter-clockwise (covers, lines 33-37)
