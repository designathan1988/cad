# src/elements/kinds/guide.ts
Lines: 93
Summary: Guides in the registry: endless lines (or points and circles) over the walls; validation (unit direction), selection within the guide tool's pixel reach, moving/mapping (direction and circle radius by the transform), plan drawing (a dashed endless line, a cross-in-circle point, a dashed circle with its centre), fields; dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: a line without ends; framing counts its point; only crossing windows take it
- 4-10 imports: vector, guards, ElementKind, clearGuides, guideFields, guide schema, GUIDE_PX
- 12-13 POINT_GUIDE_R 2 cm extra reach for a point guide
- 15-27 the kind: key, prefix, category guides, layer over, endless, icon, titles, dropped, exportName/exportColour (F-0047)
- 28-36 valid: id, level, point, a unit direction (±1e-6), shape point or circle with a positive radius
- 37-41 memo by element; derive is the guide; outlines: its point and one step along
- 42-47 hit: a point within GUIDE_PX px (+2 cm), a circle within GUIDE_PX of its rim, a line within GUIDE_PX of it
- 48-49 picked after walls
- 50-58 moved; mapped: point, direction through the transform, a circle's radius measured through it
- 59-60 similar: every guide is like every other
- 61-63 plan: a line drawn across the view (p.line), dashed, thicker when selected
- 64-90 a point (circle and cross, moveTo starts new sub-paths) or a dashed circle with a small centre cross
- 91-92 fields: the note and clearing the guides of the first selected guide's level

## Contracts, state and data flow
- Pure drawing; the snapping on guides is in tools/snap.ts.

## Depends on / used by
- uses: core/vector.ts, core/guards.ts, elements/guide/*, tools/guide-tool.ts (GUIDE_PX)
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0047 (export members)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/moveTo : moveTo starts a new sub-path, no line from the previous point (lines 72-86)
