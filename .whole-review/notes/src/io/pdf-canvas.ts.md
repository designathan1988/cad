# src/io/pdf-canvas.ts
Lines: 714
Summary: The vector PDF writer of the removed documentation area: a stand-in 2D canvas context that records PDF page operators (paths, Bézier arcs, fills, strokes, clips, transforms, alpha states, standard-14 text in WinAnsi, hatch tiling patterns, images) and assembles a PDF 1.4 file with compressed streams. Nothing in src creates one now; only render/hatch.ts asks isPdfCanvas (F-0095).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 header: a vector PDF stand-in for a 2D canvas (plan, sections, sheets printed as lines): paths, fills, strokes, clips, transforms, alpha, standard-14 text, hatch patterns, images; mm units y down → points y up
- 11-25 Affine type, identity, multiply, apply, stretch (average scale)
- 27-34 PT_PER_MM and n() (three decimals, no "-0")
- 36-68 Rgba and parseColour: transparent/white/black, hex 3-8 digits, rgb()/rgba() with % or values
- 70-99 WinAnsi bytes (Windows codes for typographic marks, spelled substitutes for missing signs) and literal() escaping
- 100-124 VectorPattern (hatch tile lines), PdfImage, PdfPattern
- 126-136 TextMeasurer and Helvetica baselines per canvas baseline
- 138-204 browserMeasurer: offscreen canvas measures (Arial for Helvetica), any CSS colour read back through a pixel, pictures downsampled to 2400 px into RGB and alpha
- 206-227 State and fontOf (F1/F2 by weight, size from px)
- 229-260 PdfCanvas: page size, ops, images, patterns, alphas, fonts, state stack, bases; the base map mm → points with y up
- 262-334 state accessors: fill/stroke (strings or vector patterns), line width/cap/join/miter, dash, alpha, font, align, baseline
- 336-345 save/restore with q/Q
- 347-383 transforms, setTransform from the current base, pushBase/popBase for views inside frames
- 385-401 paths in page points: beginPath, moveTo, lineTo
- 402-417 bezierCurveTo and quadraticCurveTo (raised to a cubic through the inverse map)
- 418-430 closePath and rect
- 431-452 arc: sweep normalised like a canvas, split in quarter turns, each a cubic with k = 4/3·tan(step/4)
- 453-477 arcTo (a line only), ellipse (arc under a scale, map restored without Q), roundRect (one radius)
- 479-521 painting state: alpha graphics states, colours, fill (colour or pattern), stroke pen scaled by the map
- 522-556 fill (nonzero/even-odd), stroke, clip, fillRect, strokeRect, clearRect (white)
- 558-586 text: measured as Arial, squeezed to maxWidth, aligned, baseline offset, its own upright map, BT…ET
- 588-607 drawImage with 2, 4 or 8 arguments, the image XObject placed by cm
- 609-626 vectorPattern (a hatch tile as lines with its transform) and createPattern (null)
- 628-633 content(): the operators with every open save closed
- 635-642 invert and isPdfCanvas (the one export the app still imports)
- 644-653 ascii, deflate (CompressionStream 'deflate' = zlib, FlateDecode) and infoText (UTF-16 hex)
- 655-713 pdfOfVectorPages: catalog, pages, two Type1 fonts, per page images (with soft masks), tiling patterns, alpha states, content stream, resources and page object; info; header, objects, xref and trailer; bytes joined

## Contracts, state and data flow
- Pure but for the measurer (DOM canvas) and CompressionStream. Only render/hatch.ts imports it (isPdfCanvas), and tests/io/pdf-canvas.test.ts tests it; no app code creates a page (F-0095).

## Depends on / used by
- uses: DOM canvas (measurer), CompressionStream
- used by: render/hatch.ts (isPdfCanvas), tests/io/pdf-canvas.test.ts

## Problems found (finding IDs)
- F-0095 (S3): leftover of the removed documentation area

## To check in other files
- src/render/hatch.ts and plan-view.ts: the vector-page branches to remove

## Sources
- https://en.wikipedia.org/wiki/Composite_B%C3%A9zier_curve : a 90° arc as one cubic with k = 4/3(√2 − 1); circles from four cubic segments (lines 431-452)
- https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream : the Compression Streams API (deflate formats) used for FlateDecode (lines 646-650; opened for library-file.ts)
