# src/elements/kinds/measure.ts
Lines: 279
Summary: Measure marks in the registry: angle (arc between arms, degrees), an arc wall's radius / diameter / length (held by the wall), a point's coordinates; their text, lines, text place, validation, selection by text or lines, moving/mapping/transforming, plan drawing (ticks, arrows, centre mark, upright value on a backing), fields; plus a DXF writer and DXF text left from the exports (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: how each is drawn; "On the DXF as lines and texts" (export taken out: F-0047)
- 6-14 imports: guards, Point2, i18n, lengthNum, contract types, segmentDistance, updateMeasures, placeMeasure, measure schema
- 16-19 MeasureSolid: measure and its placement (null when its wall is gone)
- 21-24 ARC_OUT 0.4 m; DXF_H (F-0047)
- 26-31 measureText: "45,0°", "x … · y …", "R …", "Ø …", "⌒ …"
- 33-42 measureDxfText: AutoCAD codes for the DXF (F-0047: no caller once dxf goes)
- 44-50 polar and arcPoints (a point every 5° at most)
- 52-61 linesOf: the angle's arc, the coordinate's leader, a radius from the centre, a diameter through it, an arc's length arc 0.4 m outside
- 63-76 textPlace: beside the angle's arc, at the label, beyond the length arc, or halfway along the radius/diameter (`radius * (type === 'radius' ? 0.5 : 0.5)`: a condition with equal branches)
- 78 isArcFace guard
- 80-91 the kind: key, prefix, no category, layer top, icon, titles by type, dropped, exportName/exportColour (F-0047)
- 92-98 valid: angle (three points, radius > 0), arc measures (wall, face, finite t), coordinate (two points)
- 99-102 derive (placed or null), element, holders (an arc measure's wall)
- 103-109 transformed: with its wall (t mirrored when the wall's ends swap), copied onto the wall's copy
- 110-120 outlines (its lines), hit (its text box, about 6.5 px a letter, or its lines), picked first
- 121-132 moved (angles and coordinates; arc measures stay with their wall), mapped, similar (same type)
- 133-135 plan: drawMeasure, selection colour
- 136-145 dxf: lines and a text on the dimensions layer (F-0047)
- 146-177 fields: for arc measures what they say and which face; for angles the arc's radius (min 5 cm); the value readout ("—" for several, "gone" when lost)
- 179-193 drawMeasure: the lines as one path
- 194-233 ticks at 45° at an angle's or an arc's ends, arms carried out to the arc, extension lines of the arc length, a coordinate's cross
- 234-257 radius/diameter: arrowheads on the arc pointing to the centre, the centre's cross
- 258-278 the value upright (rotated by −along, clockwise canvas rotation with y down), on a translucent backing

## Contracts, state and data flow
- Arc measures are held by their wall (deleted with it, carried with it): a link made by the user when placing.

## Depends on / used by
- uses: core/guards.ts, ui/i18n.ts, ui/units.ts, elements/dimension/anchor.ts, elements/measure/*
- used by: elements/registry.ts; render/plan-view.ts (drawMeasure for the draft: to confirm)

## Problems found (finding IDs)
- F-0047 (DXF_H, measureDxfText, exportName/exportColour, dxf, the header line)

## To check in other files
- elements/measure/place.ts: placeMeasure for each type

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/rotate : clockwise radians about the origin, composed with translate (lines 262-268)
