# src/elements/wall/geometry/footprint.ts
Lines: 674
Summary: The wall join engine's assembly: every wall's plan pieces layer by layer. It expands arcs into chains, builds the join graph, resolves junctions, L corners (with the user's choices), nodes and T abutments (exact against arcs where possible), splits walls at crossings and junctions, carries arc stems, clips layers, cuts notches, and warns where joins cannot be made exact.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: each layer's band, lengthened at joined ends and clipped by the same half-planes, tiles the wall
- 5-18 imports: tolerances, vector ops, join resolvers (cut-l corner, cut-t abutment, discover, junctions, node, sectors), join types, wall schema, arc chain helpers, convex helpers, offset helpers, shapeOf
- 20-31 Piece and WallGeometry types; keyOf for an end; byIdOrder for a stable order
- 33-50 computeWallGeometry: shapes in id order; bad shapes warned; arcs expanded into segment chains ('arcTooTight' warned)
- 52-63 the user's EndJoin choices keyed by the shapes' ends (an arc's first/last segment); 'off' ends set apart
- 64-84 the join graph (deriveJoins without the 'off' ends), lookups, end cuts and notches, warnings reported by wall, arc stems and splits, arcReach (an arc end's reach is the whole arc)
- 85-111 junctions first (§7.6): passing walls split at the point, sector arms, goingThrough or resolveSectors; not exact → complexJoin warning; exact → the joins it absorbs, notches, split cuts and end cuts
- 112-155 corners (L): reach for arcs; layered for two straight walls or an arc abutting; the user's choice (through, stop, square, miter) turned into a forced corner for two straight walls only; resolveCorner; warnings
- 156-166 an arc's end segment abutting in a butt: notches bounded by the segment's radial plane; else the corner's notches
- 167-186 an arc at a corner: a butt's arc stem carried, or a straight wall spilling over the arc's segments (spillOverArc) split there
- 187-196 nodes (three or more ends): resolveNode; an arc's notch given to all its segments
- 197-223 abutments (T): resolveAbutment with the arc wedge; a T against an arc must fit one segment's sector, else spread over the arc (spreadOverArc) or 'arcJoinUnsupported'
- 224-233 an arc's free ends capped radially
- 235-248 spans: each shape one span with its end cuts
- 249-338 splits along each wall in station order: junction splits (each side its sector cut); crossings — arc through (spreadOverArc both sides), arc cut (on a joint or mid-segment, T both sides, stems carried), straight through straight (T both sides)
- 340-345 arc stems carried back along the chain (carryArcStem) as clips per segment
- 346-358 pieces per wall: spans' pieces with their notches, splits, carried clips; overlap warnings with arcs; deduplicated warnings
- 360-377 fitsArc: a T against an arc fits when its deepest points and face crossings lie in the host segment's sector
- 379-382 wedge: a segment's sector
- 384-412 carryArcStem: walk back from the end segment while segments still overlap the host's body; each gets the T cut (no extension) and notches within its wedge
- 414-418 Carried: a cut and the host body where it acts
- 420-436 carriedPieces: inside the host's body cut layer by layer, outside kept as they are
- 438-445 regionOf: a convex polygon's sides as half-planes (either winding)
- 447-457 StemSplit: near and far half-planes, per-wedge parts with their cuts, behind (T) or outsideCut (L)
- 459-513 spreadOverArc: a T against an arc wider than one segment; where the wall's band crosses each segment's body (nearest crossing only); the end zone; each wedge's T cut and notches; extension past the end
- 515-585 spillOverArc: an L at an arc's end whose other wall reaches past the end segment; the end segment's part keeps the L cut, other reached segments their T; null when nothing spills
- 587-605 splitPieces: far part as is, near part per wedge with its cuts, the rest behind the end or with the L's cut
- 607-617 faceCrossings: where the abutting wall's faces cross the host's faces
- 619-639 overlapsWithArcs: the last guard, arc pieces against every other wall's (straight-straight overlaps never checked: F-0089)
- 641-649 dedupe: warnings by kind and walls
- 651-657 Span: shape, end cuts, splits
- 659-673 spanPieces: per layer, the band strip lengthened by the end extensions, clipped by every end cut and the layer's cuts, then less the notches covering that layer

## Contracts, state and data flow
- Pure. Walls in id order so results are stable. Everything is derived from the walls and types each time (called through app/geometry on every derivation).
- User end-join choices act only at straight L corners (F-0088) and 'off' everywhere.
- Arc walls are chains of straight segments; most of this file handles exact joins against chains.

## Depends on / used by
- uses: core/tolerance, core/vector, wall/join (cut-l, cut-t, discover, junctions, node, sectors, types), wall/schema, wall/geometry (arc, convex, offset, shape)
- used by: app/geometry.ts (wall pieces and warnings for plan, 3D, rooms, openings), opening/void.ts (Piece type)

## Problems found (finding IDs)
- F-0088 (S3): end-join choices act only at straight L corners
- F-0089 (S4, narrowed after reading discover.ts): the final guard covers arcs only; parallel straight overlaps are reported by discovery, near-miss slanted overlaps are not

## To check in other files
- src/elements/wall/join/*: the known breaks (neighbour thrown far, piece gone at a sharp T, wall gone at a 3-end node) live in the resolvers

## Sources
- https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-19EAF7A9-331F-4271-94CC-43B76B13011E.htm : butt is the only option where a wall meets another's interior; miter and square off apply where ends meet (lines 52-63, 127-155)
- https://en.wikipedia.org/wiki/Sutherland%E2%80%93Hodgman_algorithm : clipping by half-planes one at a time (clipHalfPlane chains throughout, e.g. 431, 476, 665)
