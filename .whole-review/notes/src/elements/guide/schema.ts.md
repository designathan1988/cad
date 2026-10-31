# src/elements/guide/schema.ts
Lines: 27
Summary: The guide element: an endless construction line (a point and a unit direction) on a level, or a point or a circle (radius); snapping uses them; saved and undone like the rest; line-guide and id checks.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: SketchUp's guides / Revit's reference planes; nothing built from them; snaps onto them and their crossings; lines, points, circles
- 8 imports: Point2
- 10 GUIDE_PREFIX 'guide'
- 12-21 Guide: id, level, point, unit direction (no ends), optional shape point/circle and radius
- 23-24 isLineGuide: no shape
- 26 isGuideId: prefix and underscore

## Contracts, state and data flow
- dir must be a unit vector (the validator: to check in kinds/guide.ts).

## Depends on / used by
- uses: core/vector.ts (type)
- used by: app/guide-ui.ts, tools/snap.ts, elements/kinds/guide.ts, app/view-ui.ts (sectionAtGuide), app/selection-ui.ts

## Problems found (finding IDs)
- none

## To check in other files
- elements/kinds/guide.ts: dir normalised on reading

## Sources
- https://help.sketchup.com/en/using-guides : guide lines and points are temporary aids that do not interfere with geometry; Edit > Delete Guides removes all (lines 1-6)
