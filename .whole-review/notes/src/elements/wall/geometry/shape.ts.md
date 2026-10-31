# src/elements/wall/geometry/shape.ts
Lines: 71
Summary: A wall with its type applied (derived, never stored): ends, reference line, bulge, thickness, layers, layer offsets from the exterior face, the core's offsets and layer indices. Also the exterior offset per reference line and the core layers rule (first to last structure layer, or all).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: a wall once its type is applied; derived on every computation
- 3-5 imports: Point2 and wall schema types; stackProblem (layers/stack.ts: the one rule of a usable stack, F-0136)
- 7-22 WallShape: id, ends, reference line, bulge, thickness, layers, layer offsets exterior first, core offsets, core layer indices
- 24 ShapeProblem: missing or invalid wall type
- 26-37 two stacked doc comments (one leftover: F-0039 Also) and exteriorOffset: centre −t/2, exterior face 0, interior face −t (along the left normal; exterior on the right)
- 39-45 coreLayersOf: first to last 'structure' layer, or every layer
- 47-70 shapeOf: missing type, or a type whose layers stackProblem refuses (none, or a thickness not finite and above zero); thickness summed; offsets accumulated from the exterior face; core offsets; the shape (zero-length walls not refused here)

## Contracts, state and data flow
- Pure. Reference lines offered are three (centre, exterior face, interior face); Revit has six (adds core centre and core faces).
- A wall with start = end passes here; callers must avoid normalising its zero direction (to check in the join discovery).

## Depends on / used by
- uses: core/vector (type), wall/schema (types), layers/stack.ts (stackProblem)
- used by: wall/geometry/footprint.ts (shapeOf), arc.ts (WallShape), offset.ts, join resolvers, app/geometry

## Problems found (finding IDs)
- F-0039 (Also): stacked doc comments
- F-0136 fixed: the usable-stack test is stackProblem's

## To check in other files
- src/elements/wall/join/discover.ts: zero-length walls

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-F26DB6DA-A0EC-424D-B656-3BDF47607F4F.htm : Revit's location lines (wall/core centre, finish/core faces) and the core as the main structural layers (lines 26-45)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite : Infinity and NaN are not finite (the thickness rule stackProblem applies, line 50)
