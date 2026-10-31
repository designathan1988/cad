# src/elements/roof/geometry.ts
Lines: 143
Summary: A roof's solid. Each sloped side is a plane rising from its wall line, and the roof is the lowest plane at each point: every face is the eaves outline clipped by "my plane is the lowest" half-planes. Gables are vertical infills; a flat roof (or any non-convex sloped one) is one face at the eaves with its parapet.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: planes h_i(p) = base + g_i·inside distance; lowest wins; exact by half-planes; hip = straight skeleton on a convex outline; overhangs; gables; flat with parapet; pure
- 8-10 imports: ConvexPolygon, clipHalfPlane, signedArea; Point2; Roof
- 12-19 RoofFace: ccw polygon, plane z(p), grade
- 21-35 RoofSolid: roof, eaves outline, faces, gable polygons in 3D, parapets, base, top, notConvex
- 37-50 cross and isConvex: one sign of turn at every corner (collinear corners skipped)
- 52-58 crossing: the intersection of two lines, null when parallel
- 60-68 roofSolid start: outline made ccw; side index remapped when reversed (n − 2 − i); edge data or a default gable; eaves base = level top + base offset (all heights depend on levelTop: F-0013 Also)
- 69-77 sides: unit direction, inward normal, grade as rise/run (null when ≤ 0), overhang ≥ 0
- 78-84 eaves outline: each side's line pushed out by its overhang, corners at the crossings
- 85-88 sloped sides; notConvex; each plane; the flat face
- 89-102 flat (no slope) or non-convex (F-0081): one face at the eaves; parapet bands 15 cm inward on the wall lines, from the base to thickness plus parapet
- 103-116 faces: for each sloped side, the outline clipped by h_s ≤ h_o against every other sloped side (O(n²) clips)
- 117 zAt: the lowest plane at a point
- 118-139 gables: each unsloped side from the eaves to the roof, broken where the lowest plane changes (pairwise crossings along the side); only those rising above the eaves
- 140-142 top: highest face corner plus thickness; the solid

## Contracts, state and data flow
- Pure; depends on the roof and the level's top passed in. Callers caching by roof alone go stale on level changes (F-0013).
- Exact only for convex outlines; non-convex sloped roofs fall back to flat (F-0081).
- Overhang eaves sit below the base by grade × overhang (the planes continue past the wall line).

## Depends on / used by
- uses: wall/geometry/convex, core/vector (type), roof/schema (type)
- used by: app/document.ts:314-321 (roof covers for wall tops), app/geometry.ts and elements/kinds/roof.ts (3D, plan, sections), roof/fields.ts (RoofSolid type)

## Problems found (finding IDs)
- F-0081 (S3): non-convex sloped roofs built flat
- F-0013 (Also): heights depend on levelTop

## To check in other files
- src/elements/roof/schema.ts: edgesFor on non-convex outlines

## Sources
- https://en.wikipedia.org/wiki/Straight_skeleton : a roof over any simple polygon (non-convex too) by the straight skeleton, splitting at reflex vertices (lines 1-6, 86-89)
