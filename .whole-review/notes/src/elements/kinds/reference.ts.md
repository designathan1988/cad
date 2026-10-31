# src/elements/kinds/reference.ts
Lines: 138
Summary: Reference drawings in the registry (pictures, PDF pages as pictures, DXF lines) under everything, faint: picture cache, point-in-polygon pick (last of all), moving/mapping (a mirror turns it), fields (opacity, angle, scale readout, calibrate), and the drawing (the picture mapped by a canvas transform, or the DXF lines); dead export members (F-0047).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: under floors and walls; picked last, so tracing takes the walls first
- 5-10 imports: Point2, num/t, updateReferences, contract types, reference schema
- 12-18 pictures: a module-level Map from the picture's data URL (the whole data string, often megabytes) to its Image, never emptied: a deleted or replaced reference keeps its decoded image in memory for the session; onReferenceLoaded set by the app to redraw
- 20-30 picture: made once per data (onload redraws; no onerror: a bad picture stays not drawn); ready when complete with a natural width
- 32-40 inside: even-odd ray casting
- 42-54 the kind: key, prefix, no category, layer under, icon, titles (its name), hint, dropped, exportName/exportColour (F-0047)
- 55-62 valid, memo by element, derive itself, outlines (corners), hit inside, picked last, moved
- 63-69 mapped: its corner and the direction of its x side through the transform; scale × factor (a mirror turns it)
- 70 plan: drawReference
- 71-91 fields: opacity (0.05..1), angle in degrees, scale readout (per pixel for pictures, times for DXF), calibrate for one
- 93-107 drawReference: opacity; a picture drawn through transform(a,b,c,d,e,f) built from three of its corners on screen so pixel (0,0) is its top left
- 108-121 a DXF's lines (four numbers each) through referencePoint
- 122-137 selected: its outline dashed

## Contracts, state and data flow
- The picture cache grows with every picture ever shown (F-0054).

## Depends on / used by
- uses: ui/i18n.ts, elements/reference/*
- used by: elements/registry.ts; app/app.ts (onReferenceLoaded); render/plan-view.ts (drawReference?: to confirm)

## Problems found (finding IDs)
- F-0054 picture cache keyed by data URLs, never emptied
- F-0047 (export members)

## To check in other files
- elements/reference/schema.ts referencePoint/referenceCorners

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/transform : multiplies the current matrix by [a c e; b d f]; x' = a·x + c·y + e (line 105)
