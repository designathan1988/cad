# src/render/hatch.ts
Lines: 104
Summary: The plan's and sections' cut hatches. A small tile of lines per pattern (brick and wood diagonals, insulation zigzag, concrete dots and triangles) is drawn at device pixels (plan) or at the page's resolution in millimetres (sections) and repeated as a canvas pattern. A vector page (the removed PDF) gets the lines instead (F-0095).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: one tile per pattern, colour and pixel ratio, drawn at device pixels and scaled back
- 5-6 imports: CutPattern; isPdfCanvas (the removed PDF writer)
- 8-11 TILE 8 CSS px and the tile cache
- 13-42 strokes: each pattern's lines in tile units; null for solid/none
- 44-70 paperHatch: a section's hatch with tiles in millimetres at the page's resolution; the vector-page branch (53); the tile drawn and the pattern scaled to millimetres
- 72-103 hatchPattern: the plan's hatch; vector-page branch (75-78); cached by pattern, colour and dpr; a tile at device pixels, pattern scaled by 1/dpr

## Contracts, state and data flow
- Module cache of CanvasPatterns keyed without the context: a pattern made on one context is reused on others (spec allows any CanvasPattern as a fillStyle; MDN does not say).

## Depends on / used by
- uses: material/schema (type), io/pdf-canvas (isPdfCanvas)
- used by: render/plan-view.ts (hatchPattern), app/section-drawing.ts (paperHatch)

## Problems found (finding IDs)
- F-0095 (Also): vector-page branches of the removed PDF

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasPattern/setTransform : sets the pattern's transform with a DOMMatrix; widely available since 2020 (lines 68, 98)
