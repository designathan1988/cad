# src/ui/swatch.ts
Lines: 29
Summary: The wall type thumbnail: its layers as colour bands, each as wide as its share of the thickness (at least 1 px), the rounding error given to the widest band so the bands fill the width; and the 40×16 inline SVG of it (decorative, aria-hidden).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: layers side by side by thickness share, at least a pixel, in their materials' colours
- 5-6 imports: Material/materialIn, WallLayer
- 8-20 layerBands: total (1 when zero), rounded widths ≥ 1, the remainder added to the widest, running x, each band's colour from its material
- 22-28 layerSwatch: the bands as rects in a 40×16 SVG

## Contracts, state and data flow
- Pure strings. Colours are #rrggbb checked when files are read (project-file isMaterial with isColor), so inserting them into SVG markup is safe.
- With more layers than pixels the widest band's width can go to zero or below (not drawn); wall types have a handful of layers, so this does not arise in practice.

## Depends on / used by
- uses: elements/material/schema, elements/wall/schema (type)
- used by: ui/browser.ts and the wall type pickers (layerSwatch), ui/layer-editor.ts (layerBands)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/rect : rect width and height values; per SVG 2 a zero width does not render and a negative one is an error (lines 8-28)
