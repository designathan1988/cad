# src/elements/column/schema.ts
Lines: 65
Summary: The column element: a section at a point of a level, turned by an angle, from the level's floor up to its top (or another level's floor) plus an offset; shapes rectangle, round, I, H, L with plates; defaults; id check and its plan outline per shape.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: from the floor to the level's top (plus an adjustment); goes with its grid axes; cut in plan, solid in 3D
- 5 imports: add, Point2, scale
- 7-9 COLUMN_PREFIX 'column'; a new column 25 × 25 cm
- 11-29 Column: id, level, centre, width (own x), depth (own y), angle (radians CCW), top offset, shape, plate, topLevelId
- 31-34 ColumnShape and COLUMN_SHAPES; COLUMN_PLATE 15 mm
- 36 isColumnId: the prefix and underscore
- 38-48 columnOutline: own axes u (width) and v (depth); the plate at most a third of the section
- 49-51 round: an ellipse of 32 sides
- 52-57 I (flanges across the width at both depth ends) and H (flanges along the depth at both width ends): 12-vertex profiles
- 58-60 L: two legs meeting at the (−x, −y) corner
- 61-64 rectangle: four corners counter-clockwise

## Contracts, state and data flow
- I, H and L outlines are NOT convex: any consumer that fans or half-plane clips them as convex polygons (section-drawing.ts prismTriangles, convex.ts clipHalfPlane) would draw them wrong (to check which path columns take in 3D and sections).

## Depends on / used by
- uses: core/vector.ts
- used by: elements/column/commands.ts, fields.ts, elements/kinds/column.ts, app/kind-tools.ts, app/next-element.ts

## Problems found (finding IDs)
- none here

## To check in other files
- elements/kinds/column.ts: how the outline becomes a mesh (extrusion with holes/triangulation vs a fan)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from : Array.from({ length }, (_, i) => …) calls the map once per index 0..n−1 (line 51)
