# tests/app/temporary-view.test.ts
Lines: 69
Summary: Tests of temporary hide and isolate: none returns the same geometry; a hidden wall takes its door; a hidden door leaves its wall; an isolated wall keeps its door only; an isolated room and floor show no walls; the remaining walls are not rebuilt (same solid objects, corners kept).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: views leave elements out, the document keeps them
- 4-8 imports: floorsOf, vitest, document, applyTemporary/deriveGeometry, newOpening
- 10-17 wall helper: a masonry 15 centreline wall on the ground
- 19-27 a box with a door, a room and its floor; the geometry; sorted key lists
- 29-67 the six cases (none, hide wall, hide door, isolate wall, isolate room+floor, walls not redrawn)
- 68 the suite closes

## Contracts, state and data flow
- Pure filtering of derived maps; identity kept for untouched solids.

## Depends on / used by
- uses: src/elements/registry, src/app/document, src/app/geometry, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys : keys in insertion order (sorted anyway in line 27)
