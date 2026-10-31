# tests/ui/swatch.test.ts
Lines: 39
Summary: Tests of a wall type's thumbnail. Its layers are drawn side by side, each as wide as its share of the thickness and in its material's colour. Plaster 2 + brick 16 + plaster 2 over 40 px gives bands of 4, 32 and 4 px in the plaster and brick colours. A thin layer still shows at least 1 px, and the bands still end at the full width.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: layers side by side, by share and colour
- 4-6 imports: vitest, BUILT_IN_MATERIALS, layerBands
- 8-24 three layers over 40 px: [0, 4, plaster], [4, 32, brick], [36, 4, plaster] (the built-in colours written in the test)
- 26-38 a 1 mm paint layer with 20 cm concrete: the first band 1 px wide, the last ending at 40; suite closes (line 39 blank)

## Contracts, state and data flow
- layerBands is pure: from layers, a width and the materials, it returns x, w and fill per band, drawn as SVG rects by the caller. The test writes the built-in colours by value, so changing a material's colour breaks the test rather than being read from the data.

## Depends on / used by
- uses: src/elements/material/schema, src/ui/swatch
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/rect : an SVG rect's x, y, width and height, with fill as a presentation attribute (the bands, lines 19-23)
