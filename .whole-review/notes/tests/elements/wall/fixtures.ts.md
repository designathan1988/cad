# tests/elements/wall/fixtures.ts
Lines: 61
Summary: Test fixtures for the wall engine. A TestWall carries its layers inline (with their total thickness and an optional bulge). layer() makes one layer; testWall() builds a wall from a thickness or a layer list. engineInput() turns test walls into engine Walls plus a type map, with one type per distinct layer list (keyed by the JSON of the list). geometry() runs computeWallGeometry on them.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: inline layers, turned into Walls and a type map
- 3-11 imports: computeWallGeometry and the wall schema types
- 13-27 XYPoint and TestWall (id, ends, reference line, layers, thickness, optional bulge = tan(sweep/4), positive counter-clockwise)
- 29-33 layer(thickness, fn): materialId is the function name
- 35-44 testWall: a number gives one structure layer; thickness is the sum of the layers (reduce)
- 46-55 engineInput: type id = JSON.stringify(layers), shared by walls with identical lists; bulge copied only when non-zero
- 57-60 geometry: computeWallGeometry(walls, types)

## Contracts, state and data flow
- Pure. The type key depends on JSON.stringify of the layer objects, which is deterministic for objects built by layer() in the same key order.

## Depends on / used by
- uses: src/elements/wall/geometry/footprint, src/elements/wall/schema
- used by: every test under tests/elements/wall (arcs, arc-corner, the property suites, joins and the rest)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : property order follows Object.keys and is stable, so the same object always gives the same string (line 50)
