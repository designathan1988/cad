# src/elements/kinds/grid.ts
Lines: 108
Summary: Grid axes in the registry (on every level, not pasted): validation, derivation (the axis itself), selection (its line or its bubbles first), moving/mapping, a copy named on, plan drawing (dash-dot line, a bubble with the name past each end), fields; plus a dead DXF writer (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: an axis has no level; pasting onto another level leaves it out
- 4-11 imports: guards, vector, t, contract types, renameGrid, gridFields, grid schema, nearSegment
- 13-17 GRID_BUBBLE_PX 12; BUBBLE_R 0.35 m for the DXF (F-0047)
- 19-31 the kind: key, prefix, category guides, everyLevel, icon, titles (with its name), hint, dropped, exportName/exportColour (F-0047)
- 32-33 valid: id, a non-blank name (duplicate names accepted from a file, though renaming forbids them), distinct points
- 34-38 memo by element; derive is the axis; outlines its line; hit near the line
- 39-47 grab: a click in a bubble (12 px radius beyond each end) takes the axis before anything; otherwise picked after walls
- 48-51 moved, mapped, copied (named on from the last of its kind)
- 52 plan: drawAxis in the selection or text colour
- 53-68 dxf: line, 16-sided bubbles and names (F-0047)
- 69-70 fields: gridFields with renameGrid
- 72-107 drawAxis: the dash-dot line (14, 4, 2, 4 px), a bubble filled with the canvas colour and outlined at each end, the name centred

## Contracts, state and data flow
- Nothing in the axis's drawing or panel shows which walls/columns it carries (F-0051).

## Depends on / used by
- uses: core/guards.ts, core/vector.ts, ui/i18n.ts, elements/grid/*, elements/kinds/paint.ts
- used by: elements/registry.ts; app/kind-tools.ts (gridKind for shownGrids); render/plan-view.ts (drawAxis for the axis being drawn: to confirm)

## Problems found (finding IDs)
- F-0047 (BUBBLE_R, exportName/exportColour, dxf)
- F-0051 (the link not shown)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash : segments in coordinate units; [] makes the line solid again (lines 84, 89)
