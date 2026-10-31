# src/elements/wall/join/sectors.ts
Lines: 318
Summary: Walls meeting at one point beyond a plain L, T or X (§7.6). Each pair of neighbouring arms meets on the line from the point to the corner their facing faces make, and each arm keeps the sector between its two lines (bevelled when far). An arm whose band takes in another pair's corner goes through whole instead, with the rest split among themselves and kept out of it. Null means the point cannot be split exactly, and the caller warns.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-8 header: neighbouring arms meet on lines through their face corners; nothing overlaps or is left open; a passing wall is two arms; why the passage rule was not enough
- 10-16 imports: tolerances, vector ops, half-planes, offset helpers, WallShape, WallEnd, join types
- 18-26 SectorArm: wall (or the part up to the point), end, reach, the passing wall's id
- 28-36 TAU, ccw (signed angle u → v in [0, 2π) by atan2 of cross and dot), rotate
- 38-42 faceToward: the arm's face on a given side
- 44-71 Gaps and gapsOf: arms ordered counter-clockwise; each gap's angle (null under COLLINEAR_ANGLE: arms on top of each other) and the corner of the facing faces (none across a straight gap)
- 73 extensionOf: the join extension for the thickest arm
- 75-120 resolveSectors: at least three arms; first a wall through the point taking in a corner goes through; else split; else the widest arm taking in a corner; else a passing wall with all the others on one side, thickest first; else null
- 122-174 goingThrough: the wide arms squared at the point; the rest a crossing wall, one squared end, an L of two, or sectors again; a passing wall's faces bound the rest; an end's band ahead of the point notched out of the others
- 176-206 widestTakingIn: the thickest passing wall (through the point only, first pass) or end whose band strictly holds another pair's corner (ahead of the point for an end)
- 208-297 splitSectors: around the point, else around the middle of the corners (when inside every arm), else around the point with one end's sector past a half-turn (cut by bevels and a notch). Per gap: the dividing line through its corner (a far corner of a 90°-270° gap replaced by the bisector, a far outer corner bevelled); a corner past an arm's reach → null; each arm cut by its two lines and bevels
- 299-310 strictlyWithinBand (off the faces by more than rounding) and OFF_FACE 1e-9
- 312-317 withinBand: inside the band, faces included, with tolerance

## Contracts, state and data flow
- Pure; straight walls only (callers check). Recursion between goingThrough and resolveSectors ends because the arm count drops.
- Exactness is all or nothing: null leaves the caller's warning and square ends.

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry (convex, offset, shape), wall/schema, wall/join/types
- used by: wall/join/node.ts (resolveSectors), wall/geometry/footprint.ts (junctions: resolveSectors, goingThrough)

## Problems found (finding IDs)
- none (the 3-end node break, if it comes from here, needs the app test's case)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Atan2 : atan2 range (−π, π]; the signed angle from u to v is atan2(u×v, u·v), mapped to [0, 2π) by adding 2π (lines 30-34)
