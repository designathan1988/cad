# src/elements/roof/schema.ts
Lines: 69
Summary: Roof data: an outline (ccw), per-side slope (null for a gable) and overhang, a kind that sets the sides, thickness, base offset, parapet and covering. The file also holds the defaults and edgesFor, which slopes the sides of each kind.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: roofs by outline, each side a slope or a gable and an overhang; kinds flat, shed, gable, hip
- 6 import: the Point2 type from core/vector
- 8-9 ROOF_PREFIX and RoofKind (flat, shed, gable, hip)
- 11-15 RoofEdge: grade % or null (gable), overhang m
- 17-32 Roof: id, level, outline ccw, edges, kind, thickness square to the slope, base offset from the level's top, parapet, covering (comment points at the removed sim/envelope.ts: F-0036 Also)
- 34-41 RoofCovering and its default: clay tile 1 cm
- 43-47 defaults: 30 %, 0.5 m overhang, 0.12 m thick, 0.8 m parapet
- 49 isRoofId: whether an id has the roof prefix
- 51-68 edgesFor: the longest side, the side most opposite to it (least dot product), and which sides slope per kind (hip all, gable those two, shed the longest, flat none), all at one grade and overhang

## Contracts, state and data flow
- Pure. The kind is only how the sides were set; geometry.ts reads the edges. Non-convex outlines get sloped sides that geometry then ignores (F-0081 Also).

## Depends on / used by
- uses: core/vector (type)
- used by: roof/commands, fields, geometry, elements/kinds/roof.ts, presets.ts, app/document.ts (covers), material/commands (covering ids not counted: F-0058)

## Problems found (finding IDs)
- F-0081 (Also): edgesFor ignores convexity
- F-0036 (Also): stale thermal comment

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Hip_roof : hip roofs slope on every side and are built on many plan shapes, valleys at inner corners (lines 2-3, 66)
