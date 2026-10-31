# tests/elements/wall/layers.test.ts
Lines: 414
Summary: Tests of wall layers, the core and type problems, every value worked by hand.

Layered L corners:
- With the same sequence, layer k meets layer k on the miter.
- A wall drawn the other way reads its layers reversed from the corner, so it is a butt layer by layer: the outer finishes wrap the corner and no core shows outside.
- Different types butt: the cores meet, and the other wall's finish wraps the end of the through core.
- Butt with finishes on both walls.
- A butt whose through corner falls past the short wall's free end warns wallsOverlap.
- Short through walls of 2 and 3 cm: no layer reaches past their free end.
- A butt nearly in line (178°) becomes one shared cut.
- Thicknesses within 1 mm count as the same sequence, so a miter.

Derived shape (shapeOf):
- The thickness is the sum of the layers, and the core spans from the first to the last structure layer.
- With no structure layer, the core is the whole wall.
- A missing type, an empty type, or a zero or NaN layer is refused.
- A wall with a bad type warns and draws nothing; the other walls are still drawn.

Layered T:
- The core runs to the host's core face.
- A layer passes host layers of lower priority and stops at the first layer of equal or higher priority (Revit's function priorities: structure 1, substrate 2, thermal 3, finish 1 4, finish 2 5).
- The host's finish is notched exactly where layers pass; the host's core and exterior finish are untouched.
- The total area is as expected; a wall with no structure is all core.
- Layers that pass need not be adjacent.
- A wall with both ends inside the host warns and cuts nothing.

X crossings:
- The thicker core passes; the other wall is split, its layers stopping by priority on both sides, and the through wall is notched.
- The total area is as expected.
- Thicker core wins regardless of ids; equal cores go to the lower id.
- A wall crossed twice is split into three spans in order.
- An end inside the other band is a T, even when it sits past the host core.
- The same type on two reference lines ties exactly (0.11999999999999998 against 0.12).
- Cores less than 1 mm apart tie.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-20 header, imports (vitest, vec, computeWallGeometry, shapeOf, Wall/WallType, fixtures, shoelace), expectPolygon to 1e-12
- 22-23 the plastered stack: 2 cm finish 1, 15 cm structure, 3 cm finish 2
- 25-43 layered L, same sequence: a's three layer polygons cut on y = x; b's share each miter segment
- 45-64 b flipped (drawn upward): butt layer by layer; a's finishes and core stop at b's faces and core faces; b's outer finish wraps to a's outer core face; area 1.4
- 66-79 different types (20 cm solid with 5 + 15 cm): a through to x −0.05; b's finish runs down to y −0.1 over a's end; area 1.4
- 81-100 butt with thin finishes (1 + 10 + 1 cm): every layer polygon, area 4.06·0.2 + 0.12·2.9
- 102-113 a 40 cm wall with a 10 cm, 0.3 m stub at 135°: the butt corner at t ≈ 0.333 is past the stub's end: wallsOverlap
- 115-142 a 2 cm through wall against a 120° wall with a thermal layer: no warnings, thermal stops at y 0.1, core at 0.08, nothing past x 0.02; with 3 cm, b's finish wraps to y −0.07
- 144-157 butt at 178°: the corner is 2.86 m away (past 10 × 0.1), so one shared cut across the mean direction
- 159-168 thicknesses 20.5 mm against 20 mm: a miter (a's finish 2 unnotched, b's core below y −0.07); suite closes
- 170-190 shapeOf: thickness 0.29, layer offsets, core −0.125 to 0.125
- 192-199 no structure layer: core [0, 0.2] on the exterior face
- 201-206 missingWallType; invalidWallType for an empty list, a 0 layer, a NaN layer
- 208-217 computeWallGeometry with a missing type: warns missingWallType for 'lost', draws it nothing, draws 'ok'; suite closes
- 219-227 layered T setup: the host plastered, the abutting wall 1 + 10 + 1 cm from (3, 0) up
- 229-239 core to y 0.07; finish 1 (priority 4) passes the host's finish 2 (5) to 0.07; finish 2 against finish 2 stops at 0.1
- 241-251 the host's finish 2 is notched into two pieces from 0 to 2.95 and from 3.06 to 6; its core and finish 1 are whole
- 253-262 total area 1.428; a wall with no structure runs entirely to 0.07
- 264-290 host with substrate: thermal passes finish 2 and stops on the substrate (0.09); core 0.07; finish 2 at 0.1; host finish 2 and substrate notched; area 1.2 + 0.14·1.9
- 292-307 non-adjacent passing layers: the host's finish 2 keeps a piece between 3.03 and 3.05
- 309-315 a stub with both ends inside the host: wallsOverlap [t, host], nothing cut; suite closes
- 317-326 X setup: a plastered along y = 0, b 1 + 10 + 1 cm along x = 3; helpers for the pieces below and above
- 328-345 b's core in two pieces stopping at −0.08 and 0.07; finish 1 stops at −0.1 below and passes to 0.07 above; finish 2 stops at ±0.1
- 347-358 a's finishes notched on both sides, its core whole; area 1.656; no warnings
- 360-370 a thicker core wins whatever the ids; with equal cores the lower id goes through
- 372-379 a 10 m wall crossed at x 7 and 3: three spans; area 1 + 0.8 + 0.8 − 0.04
- 381-394 an end inside the band is a T; with the end past the host core (y 0.09) the host's finish 2 stays whole and finish 1 is notched
- 395-406 the same type on the exterior and interior faces: a tie, the lower id goes through (one core piece for a, two for b)
- 408-413 cores 0.12 and 0.1205: a tie, the lower id goes through; suite closes (line 414 blank)

## Contracts, state and data flow
- The join engine works layer by layer, following function priorities (layers/priorities as in Revit) and per-corner butt/miter rules. Core ties use a 1 mm tolerance, then the lower id. These tests cover the static geometry; the edit-time defects (F-0101, F-0106) are elsewhere.

## Depends on / used by
- uses: src/core/vector, src/elements/wall/geometry (footprint, shape), src/elements/wall/schema, tests/elements/wall/fixtures, oracle
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://rvtdocs.com/2026/Autodesk.Revit.DB.MaterialFunctionAssignment : Revit's layer functions and default priorities: Structure 1, Substrate 2, Insulation 3, Finish1 4, Finish2 5, Membrane 0 thickness (lines 233-239, 264-290, 335-345)
