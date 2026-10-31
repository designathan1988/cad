# tests/elements/wall/oracle-arc.ts
Lines: 406
Summary: The arc oracle used by the arc tests. It has its own circle, its own segmentation (the spec's formula) and its own trapezoid bodies; it uses none of the engine's geometry code. The engine's output is checked against it by sampling: no overlap, no gap, nothing outside the bodies except near the joined node. Helpers:
- circleOf, faceRadii, segmentsOf, arcBody, intoOf (tangent into the body);
- a seeded mulberry32 generator;
- segmentWall: segment i as a straight wall along its chord, with layers scaled by cos(Δ/2);
- arcCorner: the spec's L between the end segment and a straight wall, and where that L applies;
- coverage: the sampling check;
- sharedArea: its own Sutherland–Hodgman clip;
- touchesArcElsewhere, distanceToSegments, comesFromOutside;
- tBeyond and tFill: what a T against an arc drops and what it fills;
- cornerReach: how far an L's corner reaches along the wall, bounded by the miter limit.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: an independent oracle checked by sampling
- 5-11 imports: WallEnd, fixtures (geometry, layer, TestWall), oracle (cornerSpec, frameOf, inside, rectOf, SPEC_MITER_LIMIT, P, Region), expectedCorner; SPEC_ARC_SAG 0.5 mm; pt()
- 13-36 OracleArc and circleOf: sweep = 4·atan(bulge), r from the chord, centre on the bisector at r·cos(sweep/2) by the bulge's sign, start angle, turn
- 38-48 faceRadii from the wall's frame; segmentsOf by the spec's formula on the larger face radius
- 50-65 arcBody: one trapezoid per segment on the two face circles; bodyOf (arc or rectangle)
- 67-77 intoOf: the direction into the body from an end (the tangent for an arc)
- 79-88 mulberry32: a 32-bit seeded generator (Math.imul, >>> 0), values in [0, 1)
- 90-96 the Coverage result type
- 98-111 segmentWall: the chord between two reference-circle points (exact ends), every layer × cos(Δ/2), bulge removed
- 113-165 arcCorner: the end segment lengthened by the miter allowance; expectedCorner with the arc's chain length as the far reach; 'overlap' passed through; applies = in the end segment's wedge, or past the node's end of the sweep, and not in another segment's body
- 167-177 two doc comments in a row for coverage (the first detached: F-0039 Also)
- 178-240 coverage: engine pieces vs bodies; samples near edges skipped (1e-7); near the node, where the corner applies, exactly its region; elsewhere overlap, gap (body point uncovered unless notKept) or extra (covered outside bodies away from the node); 12 samples per body box plus 400 in a disc at 1.5 × tip
- 242-266 sharedArea: both made counter-clockwise; Sutherland–Hodgman clip; the area or 0
- 268-278 touchesArcElsewhere: the straight wall's rectangle shares area with any segment but the end one
- 280-296 distanceToSegments: 0 inside a segment rectangle, else the least distance to its edges
- 298-317 comesFromOutside: walk the axis back from the end until it leaves the band; outside if r > rOut
- 319-336 tBeyond: in the sweep, outside the body, on the far side of the mid radius from where the wall comes
- 338-375 tFill: in the wall's band past its end, outside the body, in the sweep, on its own side of the mid radius, and (from outside) not across the ring
- 377-405 cornerReach: the farthest of the four face crossings along the wall; a shared cut reaches one thickness; otherwise capped at SPEC_MITER_LIMIT × max thickness (line 406 blank)

## Contracts, state and data flow
- Pure, apart from the seeded generator's own state per call. The oracle implements the spec independently (the shared pieces are only frameOf, inside, rectOf and the corner spec from oracle.ts/oracle-x.ts, also test code). geometry() is the engine under test, called only to read its pieces.

## Depends on / used by
- uses: src/elements/wall/schema (type), tests/elements/wall/fixtures, oracle, oracle-x
- used by: arcs.test.ts, arcs.property.test.ts, arc-corner.test.ts, oracle-arc.test.ts

## Problems found (finding IDs)
- F-0039 (Also: the detached doc comment at 167-173)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul : C-like 32-bit multiplication, used by hash and PRNG code (mulberry32, lines 79-88)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Unsigned_right_shift : x >>> 0 converts to an unsigned 32-bit integer (lines 80-86)
- https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm : clipping against one edge's line at a time (sharedArea, lines 242-266)
