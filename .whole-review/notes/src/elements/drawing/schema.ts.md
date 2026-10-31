# src/elements/drawing/schema.ts
Lines: 77
Summary: The drawing settings: the plan's scale (1:20 to 1:500), the pen widths by role at 1:100, what room tags say; the pen scale factor by scale, the detail level by scale, text sizes on paper, paper sizes, and the file guard.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-9 header: pens set at 1:100, heavier at larger scales; texts keep their size on paper; detail by scale; a pen unit is a pixel on screen
- 11-12 PenRole: cut, seen, fine, annotation
- 14-16 RoomTagContent and ROOM_TAGS
- 18-25 DrawingSettings: scale, pens, roomTag
- 27-28 SCALES: 20, 25, 50, 75, 100, 200, 250, 500
- 30-31 PEN_UNIT_MM 0.12 mm (a screen pixel at 1:100)
- 33-34 DEFAULT_DRAWING: 1:50; pens 0.36 / 0.24 / 0.12 / 0.13 mm
- 36-38 PEN_MIN 0.05, PEN_MAX 2 mm
- 40-48 scaleFactor: 1.4 (≤ 1:25) … 0.7 (> 1:250)
- 50-55 Detail and detailOf: fine ≤ 1:50, medium ≤ 1:100, coarse beyond
- 57-58 TEXT_MM: text sizes on paper by CSS size token
- 60-61 PAPERS: A4–A0 landscape (ISO 216 sizes); no reader left in src (printing was taken out: F-0036)
- 63 finite: a finite number guard (another copy of core/guards.ts finite)
- 65-76 isDrawingSettings: a scale from SCALES, every pen finite within range, a known room tag

## Contracts, state and data flow
- A saved view's den (saved-views.ts) is any positive number, while the project's scale must be one of SCALES: a view could carry a scale the list does not offer.

## Depends on / used by
- uses: nothing
- used by: render/plan-view.ts (scaleFactor, detailOf, TEXT_MM, PEN_UNIT_MM), app/document.ts (drawingOf), ui/drawing-dialog.ts, app/section-view.ts, app/room-tag.ts, io/project-file.ts (guard), elements/contract.ts (types)

## Problems found (finding IDs)
- F-0036 (PAPERS: the removed printing's paper sizes, no reader)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/ISO_216 : A-series sizes (A4 210 × 297 mm, √2 ratio, A0 ≈ 1 m²) (line 61)
