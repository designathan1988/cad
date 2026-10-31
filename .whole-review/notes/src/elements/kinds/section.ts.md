# src/elements/kinds/section.ts
Lines: 181
Summary: Section and elevation marks in the registry (on every level, an interior elevation on its room's level): selection (line, or bubbles first), moving/mapping (a mirror swaps the ends), fields (name, kind, width, depth, flip, open the drawing), and the plan mark (dash-dot line with heavy ends, bubbles with name and an arrow the way it looks); dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: no level, drawn on every plan; a room's interior elevation keeps to its level
- 5-12 imports: isObject, vector, lengthText, t, contract types, section commands, section schema, nearSegment
- 14-18 SECTION_BUBBLE_PX 11; BUBBLE_R 0.3 m (DXF: F-0047)
- 20-32 bubbles: past each end of a section, at the middle of an elevation
- 34-50 the kind: key, prefix, no category, everyLevel, layer over, icon, titles, hint, dropped, exportName/exportColour (F-0047)
- 51-56 valid, memo, derive itself, element, outline (its line), hit near the line
- 57-66 grab: a click in a bubble (the same positions as bubbles(), computed again in plan units)
- 67-70 picked after walls; moved; mapped: a mirror swaps the ends so it still looks the mirrored way (depth not clamped to DEPTH_MIN there, as it is otherwise)
- 71 plan: drawSectionMark
- 72-84 dxfLayers/dxf (F-0047)
- 85-113 fields: name (one), kind readout (section, elevation, interior), width readout, depth (min DEPTH_MIN), flip, open the drawing (one)
- 115-140 drawSectionMark: the look turned to screen y; the line dash-dotted (section) or dashed (elevation)
- 141-150 a section's ends heavy (cut pen ×1.5, up to 18 px)
- 151-180 per bubble: the arrow triangle toward the look, the bubble, the label: a name longer than 3 characters is cut to its first letter (upper-cased), then narrowed by scale() to fit (F-0055: room 12's interior elevation "12-N" shows "1")

## Contracts, state and data flow
- Pure drawing.

## Depends on / used by
- uses: core/guards.ts, core/vector.ts, ui/units.ts, ui/i18n.ts, elements/section/*, elements/kinds/paint.ts
- used by: elements/registry.ts; render/plan-view.ts (drawSectionMark for the draft: to confirm)

## Problems found (finding IDs)
- F-0055 marks named with more than 3 characters show only their first letter
- F-0047 (export members)

## To check in other files
- elements/section/schema.ts nextSectionName (names given)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/scale : multiplies the transform, applies to text drawn after; save/restore scopes it (lines 173-177)
