# src/elements/wall/geometry/arc.ts
Lines: 121
Summary: Arc walls as chains of straight segments. It covers the circle from a wall's ends and DXF bulge, points, tangents and face radii, the segment count from the sag tolerance, expanding an arc wall into segments whose layers are scaled by cos(Δ/2) so neighbours meet on radial lines, the radial caps, segment ids and parents, and each segment's sector.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-7 header: chords of concentric circles are parallel; segments are straight walls scaled by cos(Δ/2); miters fall on radial lines; count from ARC_SAG, never the view
- 9-12 imports: ARC_SAG, vector ops, HalfPlane helpers, WallShape
- 14 MAX_SEGMENTS 2048
- 16-25 Arc: centre, reference radius, start angle, signed sweep, turn (+1 ccw)
- 27-46 arcOf: null when straight or zero length; sagitta = bulge × chord / 2; radius = (c/2)² / (2|s|) + |s|/2 (same as ((c/2)² + s²)/(2|s|)); centre on the chord's left for a positive bulge; sweep = 4 atan(bulge)
- 48-55 pointAt, tangentAt (drawing direction), radiusOf (left offset o is radius r − turn·o)
- 57-61 segmentCount: step 2·acos(1 − sag/rMax) over the largest face radius, 1..2048 segments
- 63-76 ArcChain (arc, segments, radial caps); SEGMENT_MARK and parentOf (`wall#k` → wall)
- 78-108 expandArc: throws on a straight wall; 'arcTooTight' when a face radius ≤ 0; n equal angular steps; each segment a straight wall with the exact end points at the chain's ends, thickness, layer offsets and core scaled by cos(step/2); radial caps at both ends
- 110-117 sectorOf: the two radial half-planes of segment i
- 119-120 inSector: inside every half-plane with a slack

## Contracts, state and data flow
- Pure. Bulge follows the DXF convention: tan(θ/4), positive counter-clockwise.
- Chains are tolerance-driven (ARC_SAG), so a large radius can reach many segments; each goes through the join engine as a wall.

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry/convex, wall/geometry/shape (type)
- used by: wall geometry pipeline (footprint, joins), opening/derive (referenceLength), opening/void (openingFrame), wall/fields (radius), dimension and measure code on arcs, tools (split, snap, arc-edit)

## Problems found (finding IDs)
- none (the formulas match the bulge definitions)

## To check in other files
- none

## Sources
- https://www.afralisp.net/archive/lisp/Bulges1.htm : bulge = tan(θ/4), positive counter-clockwise; sagitta = (c/2)·|bulge|; r = ((c/2)² + s²)/(2s) (lines 27-46)
