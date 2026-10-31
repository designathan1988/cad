# src/elements/kinds/separator.ts
Lines: 51
Summary: Room separators in the registry: a thin dashed line in plan that bounds rooms (read by app/geometry.ts), no solid; validation, selection, moving/mapping, a length readout; dead DXF/export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: dashed line, no solid; rooms read them in geometry.ts
- 4-9 imports: guards, distance, lengthText, ElementKind, separator schema, nearSegment
- 11-21 the kind: key, prefix, category rooms, layer over, icon, titles, dropped, exportName/exportColour (F-0047)
- 22-23 valid: two distinct points (compared as JSON)
- 24-32 memo by element; derive itself; outline its line; hit near it; picked after walls; moved; mapped; every separator is like every other
- 33-46 plan: a dashed line (lineTo then stroke), doubled when selected
- 47-48 dxfLayers/dxf (F-0047)
- 49-50 fields: the length for one, empty text for several

## Contracts, state and data flow
- Separators shape rooms through geometry.ts; moving one changes the rooms around it (expected, the user's own line).

## Depends on / used by
- uses: core/guards.ts, core/vector.ts, ui/units.ts, elements/separator/schema.ts, elements/kinds/paint.ts
- used by: elements/registry.ts

## Problems found (finding IDs)
- F-0047 (export members)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineTo : adds to the path; drawn by stroke (lines 40-44)
