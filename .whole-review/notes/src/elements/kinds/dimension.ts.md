# src/elements/kinds/dimension.ts
Lines: 249
Summary: Permanent dimensions in the registry: validation of anchors, derivation (placed or lost), held by their walls/openings (deleted with them), selection by line or value, moving (free ends only), Modify-tool behaviour (ends follow what goes, mirrored ends swapped, copies held by the copies), plan drawing with value, EQ and padlock, keep-out boxes for room tags, fields; plus a DXF writer left from the exports (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: held by walls, doors and windows; placed from them, deleted with them, carried as they are
- 5-13 imports: lengthNum, guards, Point2, contract types, anchor helpers, commands, fields, schema, throughElement
- 15-28 Placed (points, line, length) and DimensionSolid (dim, placed or null)
- 30-31 DXF_H: the DXF text height (export taken out: F-0047)
- 33-37 isAnchor: wall (end, along, offset), opening (jamb, offset) or point
- 39-50 the kind: key, prefix, no category (always shown), layer top, icon, titles, hint, dropped, exportName/exportColour (F-0047)
- 51-60 valid: anchors, finite offset, locked > 0, chain string, eq true
- 61-64 derive (placed now), element, holders (the walls/openings of its ends), outlines (its line)
- 65-71 hit: near its line or its value (a 10 px radius around the middle); picked first
- 72-80 moved: free ends move (held ends stay); mapped: free ends mapped, offset scaled and flipped by a mirror
- 81-96 transformed in place: ends on what goes swapped when mirrored; a selected one taken whole (free ends mapped); offset kept unless taken whole or both ends go
- 97-113 transformed as a copy: ends held by the copies (swapped before re-targeting), ends on what is not copied become free points where they land
- 114-117 plan (the value, colour when selected, padlock when locked); keepOut (value box and line)
- 118-147 dxf: extension lines, dimension line, ticks and text, or a DXF DIMENSION (F-0047: no caller)
- 148-162 fields: dimensionFields with the current length per dimension and the commands
- 164-165 valueText: "EQ" for an equal chain's member, else the length
- 167-180 onScreen: screen points, line direction, the side away from what is measured, the value's place 9 px out
- 182-190 valueBox: the value's box (rotated box for an upright line)
- 192-219 drawDimension: extension lines from 3 px off the points to 4 px past the line, the line 4 px past each end, 45° ticks
- 220-236 the value upright within ±90°, on a translucent canvas box, centred (measured with the font just set)
- 237-248 a padlock before the value when locked

## Contracts, state and data flow
- Locks and EQ are shown in plan (padlock, "EQ") and in the panel: visible links, as the goal wants.

## Depends on / used by
- uses: ui/units.ts, core/guards.ts, elements/dimension/*, elements/kinds/paint.ts
- used by: elements/registry.ts; drawDimension also by render/plan-view.ts (the dimension being made: to confirm)

## Problems found (finding IDs)
- F-0047 (DXF_H, exportName/exportColour, dxf)

## To check in other files
- tools/transform.ts: Transform.mirror and factor as used here

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText : TextMetrics with the width of the text in the context's current font (lines 185-186, 224-225)
