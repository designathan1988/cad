# tests/io/pdf-canvas.test.ts
Lines: 160
Summary: Tests of the vector PDF stand-in context (io/pdf-canvas.ts), which belongs to the removed documentation area (F-0095). It checks:
- a line in millimetres becomes points with y up, its pen, colour and dash set first;
- a path is kept after a fill and can be stroked again; even-odd fill becomes f*; a clip becomes W n inside its save;
- transforms work, and setTransform starts from a pushed base;
- a full circle is four Béziers (control points 0.5523 r out);
- text uses Helvetica (bold from weight 600), sits on its baseline, is centred by its width, and is escaped and WinAnsi-encoded;
- colours parse as hex or rgb(), with alpha × global alpha as a graphics state, and nothing is drawn at alpha 0;
- hatch tiling patterns use the fill's matrix, and images are drawn as XObjects;
- the assembled file has its header, objects at the offsets the xref table gives, one page per sheet size, and %%EOF.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: what a canvas call becomes in the page content
- 4-5 imports: vitest and the pdf-canvas exports
- 7-15 a stub TextMeasurer (half an em per letter, fixed baselines, parseColour, a 2 × 1 RGB picture); a 100 × 50 mm page; k = PT_PER_MM
- 17-34 a red 0.5 mm dashed line from (10, 10) to (20, 10): m, l, RG, w, d; ends with S then Q
- 36-50 a rect filled even-odd and stroked: two paths, f*; save, clip, restore: q … W n … Q
- 52-77 translate and scale: nothing emitted before the stroke; the point at (12, 48) mm; after pushBase, setTransform is relative to the base; popBase returns to the page; multiply composes matrices
- 79-94 a full arc: 4 curves ending where they began; a quarter's first control point (0.5523 r)
- 96-111 600-weight 4px text centred and middle: /F2 4 Tf, the text matrix, the escaped (Sala \(2\)), font F2 registered; winAnsi bytes for é, ², ·, ≤ (two bytes), –, €; measureText 8
- 113-127 parseColour of #f80, rgba(), rgb(… / 25%); alpha 0.5 × 0.5 gives /GS0_25 gs; transparent draws nothing
- 129-140 a vector hatch pattern: /Pattern cs /P0 scn, its matrix flipped to the page; drawImage gives /Im0 Do
- 142-159 pdfOfVectorPages for two pages: %PDF-1.4 … %%EOF, /Count 2, A3 MediaBox in points, Helvetica-Bold; startxref points at 'xref'; each object's offset starts "n 0 obj"; suite closes (line 159; 160 blank)

## Contracts, state and data flow
- Tests a module that only render/hatch.ts still touches (isPdfCanvas), and nothing in the app creates a PDF page any more (F-0095). This test goes with the module.

## Depends on / used by
- uses: src/io/pdf-canvas
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0095 (this test belongs to the leftover module)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/PDF : the file layout: header, indirect objects, xref table of byte offsets, trailer, startxref and %%EOF (lines 142-158)
