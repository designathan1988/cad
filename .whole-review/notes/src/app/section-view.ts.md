# src/app/section-view.ts
Lines: 92
Summary: A section or elevation drawn for the sections dialog: the model's triangles and rooms cached per document, each mark's drawing cached per model, and the drawing painted on a white canvas of a frame's size at a dpi with the project's pens at its scale and the light theme's colours.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: as it prints, from the model now, white paper whatever the theme, the project's pens at its scale
- 4-12 imports: App, Doc, drawingOf, geometry, section-drawing, scaleFactor, SectionMark, name/num, Point2
- 14-15 TEXT: 2 mm text
- 17-20 Model (solids, rooms) and two WeakMap caches: model by Doc, drawings by model and mark JSON
- 22-36 sectionOf: the model for this doc (derived once; solids without the categories hidden NOW, rooms none when rooms are hidden); the drawing per mark. The model cache is keyed by the document only, but its content depends on app.ui.hidden: hiding or showing a category without editing keeps the stale drawing (F-0038)
- 38-39 levelText: "name +0,00" with a real minus sign
- 41-57 withPaperColours: the root's theme set to light while painting (computed style is live, so --vars read the light values), white canvas/underlay/bg, the theme put back (deleted when there was none)
- 59-70 sectionCanvas: canvas in device pixels for the frame at dpi, the context scaled to millimetres; the drawing; pens and scale factor; per = mm per metre at 1:den
- 71-91 painted: white background; paper transform centred on the frame; cut, seen (×0.6) and fine pens scaled; ink, cut fill, font from CSS; level, length and room texts

## Contracts, state and data flow
- Docs are immutable (store), so a WeakMap keyed by Doc is valid for what depends on the doc alone; the hidden categories are interface state outside the key.

## Depends on / used by
- uses: app/section-drawing.ts, app/geometry.ts, app/document.ts, elements/drawing/schema.ts, ui/i18n.ts
- used by: ui/sections-dialog.ts (sectionCanvas, sectionOf)

## Problems found (finding IDs)
- F-0038 the section cache ignores the hidden categories

## To check in other files
- ui/sections-dialog.ts: whether it redraws when hidden categories change

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle : the result is live; custom properties read with getPropertyValue (lines 50-52, 82)
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap : keys by identity, held weakly; a cache valid only while the computation depends on the key alone (lines 19-20, 25-34)
