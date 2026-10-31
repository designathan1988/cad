# src/app/reference-ui.ts
Lines: 170
Summary: Reference drawings under the current level's plan: a picture, a PDF's first page (rendered with pdf.js at 150 dpi to a PNG) or a DXF's lines, added as one command and selected; and calibrating one by two points and the real distance typed in a dialog.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: picture, PDF first page or DXF under the plan; calibrated by two points and a distance
- 4-13 imports: App type, newId, Point2, reference commands and schema, readDxfLines, controls, dialog, i18n, units
- 15-16 PDF_DPI: a PDF page is drawn at 150 dpi
- 18-26 pictureSize: an Image's natural size once loaded; an error → "bad picture"
- 28-34 dataUrl: a Blob read as a data URL (FileReader)
- 36-52 pdfPicture: pdf.js and its worker URL imported on demand; the document from the file's bytes; page 1 (1-based) at 150/72 scale; drawn on a white canvas; PNG data URL. The PDFDocumentProxy is never destroyed (its worker stays alive: F-0034)
- 54-58 importReference: the base reference (new id, level, name, angle 0, default opacity)
- 59-69 a DXF: its lines (4 numbers each) at its own origin, scale 1; empty → toast; skipped entity kinds listed in the toast
- 70-79 a picture or PDF: PDF chosen by extension OR MIME type, but the scale by extension only (a PDF without ".pdf" gets the picture scale: F-0033); a PDF pixel = 1:100 at 150 dpi; centred on the plan; added; toast
- 80-86 plan view, the reference selected, refresh; any failure toasted with its reason
- 88-96 pickReference: a file input (images, PDF, DXF), its first file imported
- 98-104 startCalibration: the calibrate tool on the reference, hint
- 106-119 calibrateClick: the first point, then the second (not the same point); the tool left; the distance asked
- 121-127 calibrateDraft: the line being measured (plan, calibrate tool) and its length
- 129-140 askDistance: a dialog with a number field (min 0.001) starting at the measured length, aria label, the apply button
- 141-149 apply: the reference scaled about the first point (calibrated), one command, toast; closed
- 150-156 click applies; Enter applies on the next task (after the field commits); cancel closes
- 157-165 the dialog's markup (role dialog, aria-modal, title, note, row, actions)
- 166-169 the distance field focused and selected

## Contracts, state and data flow
- Pictures and PDF pages are stored as data URLs inside the document: a large picture makes every save large (localStorage fallback quota; IndexedDB per element).

## Depends on / used by
- uses: pdfjs-dist 4.10.38 (dynamic import), io/import-dxf.ts, elements/reference (commands, schema), ui/controls.ts, ui/dialog.ts, ui/i18n.ts, ui/units.ts, core/id.ts
- used by: app/actions.ts (pickReference), app/input.ts (calibrateClick), app/frame.ts (calibrateDraft), panel (startCalibration), drop handler (importReference): to confirm

## Problems found (finding IDs)
- F-0033 a PDF recognised by MIME type gets the picture's scale
- F-0034 the pdf.js document is never destroyed

## To check in other files
- io/import-dxf.ts: units of DXF coordinates ($INSUNITS) vs scale 1

## Sources
- https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFDocumentProxy.html : getPage is 1-based; cleanup frees document resources (line 42)
- https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html : getViewport returns a PageViewport; user unit 1/72 inch (line 43); installed node_modules/pdfjs-dist/types/src/display/api.d.ts:399 canvasContext, :1069 PDFDocumentProxy.destroy "terminates the worker" (4.10.38)
