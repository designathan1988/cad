# src/tools/arc-edit.ts
Lines: 46
Summary: Pure maths for editing an arc wall's curvature with its ends fixed: the bulge from a dragged middle point (sagitta over half chord, clamped to a 340° sweep), the arc's middle point for the handle, the bulge for a typed radius keeping the side and major/minor choice, and snapping nearly straight arcs to 0.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: bulge = tan(θ/4) = s / (c/2); ends never move so joins stay; drawing arcs is wall-tool's job
- 6 import: distance and Point2 from core/vector
- 8-9 MAX_BULGE: tan(340°/4), past which the arc nearly closes
- 11-21 bulgeFromMiddle: chord length (0 → straight), the unit right normal, the signed sagitta of p from the chord's middle, bulge 2s/c clamped; `|| 0` turns -0 and NaN into 0
- 23-29 arcMiddle: the point at sagitta bulge·c/2 to the right of the chord's middle (also right for major arcs, whose sagitta exceeds half the chord)
- 31-40 bulgeKeepingSide: null when radius < chord/2 (or NaN); minor sweep 2·asin(c/2r), the major one kept when |bulge| > 1; sign of the old bulge (or +)
- 42-45 straightNear: 0 when the middle's offset is within `reach` (the caller's 8 px), else the bulge

## Contracts, state and data flow
- Pure. Sign convention: positive bulge = counter-clockwise from start to end = bulging to the right of start→end, as DXF.

## Depends on / used by
- uses: core/vector (distance)
- used by: app/select-drag.ts (bulgeFromMiddle, straightNear), app/frame.ts and app/temp-dims.ts (bulgeKeepingSide), app/handles.ts, app/wall-ui.ts, tools/snap.ts (arcMiddle)

## Problems found (finding IDs)
- none (formulas checked: s/h = (1 − cos θ/2)/sin θ/2 = tan θ/4)

## To check in other files
- none

## Sources
- https://www.lee-mac.com/bulgeconversion.html : bulge = sagitta / half chord = tan(θ/4); positive = anticlockwise from the first vertex to the second; 1 = semicircle (lines 1-45)
