# tests/elements/wall/oracle.ts
Lines: 356
Summary: The independent wall-join oracle. It shares no geometry code with the engine: it has its own vector math, its own face construction and even-odd ray-crossing containment. The spec constants (collinear angle 0.6°, miter limit 10) are written here on purpose, so a change to src/core/tolerance.ts that is not in the spec fails the tests. It provides:
- the frame of a wall;
- Cramer meet, with a guard for a zero determinant;
- shoelace area and an inside test;
- Region values;
- cornerSpec: an L classified exactly as spec §7.1/§10 (overlap, shared, bevel or miter, with its inner and outer corners);
- expectedL: the region an isolated L must cover;
- expectedT: the host untouched, plus the abutting strip clipped beyond the near face;
- roomCorners and expectedRoom;
- a mulberry32 generator;
- checkAgainst: random samples around every wall checking overlaps, gaps, extras and the area error.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: independence, and constants written here on purpose
- 5-9 imports (WallEnd, fixtures geometry/TestWall); SPEC_COLLINEAR_DEG 0.6, SPEC_MITER_LIMIT 10
- 11-22 P and the vector helpers
- 24-32 frameOf: direction, left normal, face offsets by reference line, length
- 34-42 meet(): Cramer with a 1e-300 determinant guard (null)
- 44-63 shoelace (absolute area); inside (even-odd ray crossing)
- 65-90 segDistance; edgesOf; Region; polygonRegion; disjointUnion
- 92-110 into/at/far/onFace/faceMeets; CornerKind; CornerSpec
- 112-119 two doc comments in a row above cornerSpec (the first detached: F-0039 Also)
- 120-154 cornerSpec: node (given, or the mid of the ends); the angle between the into directions; inner and outer offsets by side; < 0.6° overlap; overrun ends beyond 10·T overlap; > 179.4° shared; corners by meet; corners past either far end (or a given free reach) overlap; obtuse with spread > limit shared; outer beyond limit bevel, else miter
- 156-197 expectedL: shared → two quads cut on the line through the node across the mean direction; bevel → the tip cut at limit along the outer direction; else the six-point region
- 199-209 nearFace (the host face the abutting body leaves through); rectOf
- 211-221 keepSide: half-plane clip of a convex polygon
- 223-242 expectedT: the abutting strip from its far end, extended 10 m back, clipped to the far side of the near face; plus the host's rectangle
- 244-263 RoomCorners and roomCorners (corner k joins ring[k−1]'s second end to ring[k]'s first)
- 265-290 expectedRoom: outer ring − inner ring + the divider between its two hosts' near faces
- 292-301 mulberry32 (the same as in oracle-arc.ts)
- 303-310 the Report type: overlaps, gaps, extras, area error, samples, first bad point
- 312-354 checkAgainst: pieces from the engine; samples skipped within 1e-7 of region edges; counts overlaps (pieces, so overlapping layers count), gaps and extras; four sample boxes per wall (along, both ends, a wide box out to 2·11·maxT); area error; suite ends (line 355 blank; 356 end)

## Contracts, state and data flow
- Pure, apart from the seeded generator. The oracle encodes the spec; the engine is only read through geometry(). The constants are duplicated with the engine's on purpose (the header says why), so they are not an RC1 defect.

## Depends on / used by
- uses: src/elements/wall/schema (type), tests/elements/wall/fixtures
- used by: joins.test.ts, joins.property.test.ts, junctions.test.ts, arcs*.test.ts, nodes and layers (shoelace), oracle-arc.ts, oracle-layers.ts, oracle-x.ts, scenes.ts

## Problems found (finding IDs)
- F-0039 (Also: the detached doc comment at 112-115)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/acos : NaN outside [−1, 1], hence the clamp of the dot product before acos (line 126)
- https://en.wikipedia.org/wiki/Point_in_polygon : the even-odd ray test and its boundary behaviour (inside, lines 54-63; samples near edges skipped at 326)
- https://en.wikipedia.org/wiki/Shoelace_formula : polygon area from vertices (lines 44-52)
- https://en.wikipedia.org/wiki/Cramer%27s_rule : the 2×2 solution and the zero-determinant case it guards (lines 34-42)
