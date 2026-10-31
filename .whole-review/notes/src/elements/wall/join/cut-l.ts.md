# src/elements/wall/join/cut-l.ts
Lines: 279
Summary: Two wall ends meeting at a node (an L). With the same layer sequence from the outer face it makes a miter; otherwise a butt, layer by layer (cores meet, outer layers wrap the outer corner, inner ones meet at the inner corner), or a T-style butt where layered cuts are not wanted. The user's forced miter, through or square off is applied, an acute tip past the miter limit is bevelled, nearly straight ends share one cut, and swallowed or folded-back ends are warned as overlapping.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: miter for the same sequence, else a layered butt as Revit cleans an L; bevel past MITER_LIMIT; one shared cut nearly in line
- 7-33 imports: tolerances, vector ops, half-planes, offset helpers, WallEnd, WallShape, joinExtension and resolveAbutment, goesThrough, join types
- 35-40 CornerResult: end cuts for a and b, warning, notches
- 42-66 resolveCorner doc and signature: node, reach (an arc's end reaches its whole arc), layered, the user's force (miter, or through with square)
- 67-74 angle between the bodies; folded back (< COLLINEAR) → overlapping; nearly in line → shared cut
- 76-86 face corners (inner and outer); a corner past either wall's free end → overlapping (a stub)
- 88-97 obtuse corners too far out → shared cut; an acute outer tip past the limit → bevel half-plane
- 99-103 mitered when forced or same sequence; square off → tButt with that wall through; not mitered and not layered → tButt
- 104-116 layered butt: who goes through (forced or the thicker by goesThrough), every layer's reach checked against both free ends and the limit; bevels added
- 118-122 miter: both ends cut by the diagonal through the outer and inner corners (complementary half-planes), plus bevel
- 124-137 sameSequence: layers read from the corner's outer face, same functions and thicknesses within tolerance
- 139 far: the other end of a wall
- 141-193 tButt: through wall to the abutting wall's outer face, the abutting wall cut as in a T (resolveAbutment); with square off, the through end square to its own line through the farther face meeting
- 195-241 butt: each layer of each wall classed inner/core/outer and stopped on its line across the other wall; every layer its own cut; `reached` points for the checks
- 243-263 faceCorners: intersections of the inner faces and of the outer faces
- 265-274 sharedCut: one line through the node across the mean direction
- 276-278 overlapping: no cuts, a 'wallsOverlap' warning

## Contracts, state and data flow
- Pure. Returns null cuts with a warning when the corner cannot be made (the walls then stay as drawn: overlapping pieces, reported).
- The user's choices reach here only from footprint.ts's corner loop for two straight walls (F-0088).

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry (convex, offset, shape), wall/join (cut-t, discover, types), wall/schema
- used by: wall/geometry/footprint.ts (resolveCorner, faceCorners), wall/join/node.ts (likely faceCorners)

## Problems found (finding IDs)
- none new (the known L breaks need the app test to reproduce; resolver logic reads consistent)

## To check in other files
- none

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-6B18982C-1FBA-4E5C-AE30-6FAE4022CE35.htm : Revit butts by default, can miter or square off, chooses which wall governs, and cleans layer lines (lines 1-5, 99-116)
