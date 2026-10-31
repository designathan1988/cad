# src/elements/wall/join/cut-t.ts
Lines: 98
Summary: A wall end against another wall's flank (a T) by Revit's layer priority. The abutting core runs to the host's core face. Every other abutting layer walks into the host through host layers of strictly lower priority and stops on the first of equal or higher priority. Each host layer passed is notched where it is passed. Also the join extension constant.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: Revit's layer priority at a T; notches exactly where layers pass
- 6-12 imports: MITER_LIMIT, vector ops, half-planes, offset helpers, WallShape, LAYER_PRIORITY and WallEnd, join types
- 14-19 joinExtension: 2·(MITER_LIMIT + 1)·max thickness, enough for any cut
- 21-26 AbutmentResult: cut, notches, deepest points
- 28-37 resolveAbutment setup: which side of the host the abutting wall comes from, inward direction, the host's near core face
- 39-46 walk: the host's layers outside its core on the near side, from the near face inward, with their faces
- 48-54 depth: the core passes all; other layers stop at the first host layer of equal or higher priority (lower number)
- 55-59 the end cut: one half-plane per abutting layer at the face it stops on
- 60-67 deepest: where each layer's band edges meet its stop face
- 69-85 notches: for each host layer walked, the runs of abutting layers passing it, bounded by their band edges and short of the free end (or by the arc wedge's planes)
- 87-97 runs: maximal runs of true flags as index pairs

## Contracts, state and data flow
- Pure. Priority numbers in wall/schema.ts match Revit's (structure 1, substrate 2, thermal 3, finish 1 4, finish 2 5). The walk assumes priorities do not ascend from the core to the faces, which Revit enforces on types.

## Depends on / used by
- uses: core/tolerance, core/vector, wall/geometry (convex, offset, shape), wall/schema, wall/join/types
- used by: wall/geometry/footprint.ts (abutments, crossings, arc stems), wall/join/cut-l.ts (tButt), node.ts and sectors.ts

## Problems found (finding IDs)
- none here

## To check in other files
- src/elements/wall/types.ts: whether wall types are checked for ascending priorities from the core (Revit refuses them)

## Sources
- https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-CCDEE011-2A5E-43AC-BD60-8F81CF432A6B.htm : layer functions have an order of precedence; priorities cannot ascend from the core boundary to the finish face (lines 48-54)
