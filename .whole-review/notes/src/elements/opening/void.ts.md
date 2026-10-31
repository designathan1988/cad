# src/elements/opening/void.ts
Lines: 104
Summary: The void an opening makes in its wall. It provides the opening frame (jamb points, direction, normal, face offsets and the jamb half-planes; radial jambs on arcs), the plan cut (each convex piece minus every opening region) and the 3D cut (height bands between sills and heads, each band's pieces cut by the openings spanning it).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: plan region between jambs removed by clipOut (half-planes keep pieces convex); 3D in height slices; always cut in plan, as Revit
- 8-14 imports: TopPlane, vector ops, arc helpers, clipOut/half-planes, Piece, face offsets/direction, WallShape
- 16-22 OpeningCut: region (half-planes), absolute bottom and top
- 24-32 Block: layer index, convex polygon, bottom, top, optional sloped top plane
- 34-45 OpeningFrame: jamb points, dir, left normal, exterior/interior face offsets, region
- 47-55 openingFrame on a straight wall: stations from the start along the direction; half-planes through each jamb facing inward
- 56-71 openingFrame on an arc: stations as arc lengths; radial jambs; region as two half-planes through the centre along the tangents (a wedge, valid while the opening's sweep is under 180°)
- 73-81 cutPlan: every piece clipped by every opening region, layer kept
- 83-103 cutSolid: cuts clamped to the wall's range; sorted unique heights; consecutive slices with the same openings merged into bands; each band's pieces cut by its openings

## Contracts, state and data flow
- Pure. Convex in, convex out (clipOut by half-planes). Openings cut every layer of the host.
- The arc wedge is the intersection of two half-planes through the centre, a convex cone (correct for sweeps under π).

## Depends on / used by
- uses: wall/geometry (under-roof, arc, convex, footprint, offset, shape), core/vector
- used by: app/geometry.ts (wall solids and plan pieces), opening/parts.ts, marks.ts, symbol.ts, sides.ts (OpeningFrame)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Half-space_(geometry) : a half-plane is convex; intersections of half-planes are convex (lines 2, 54, 69, 76)
