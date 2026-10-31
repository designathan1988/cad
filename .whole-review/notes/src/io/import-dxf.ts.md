# src/io/import-dxf.ts
Lines: 120
Summary: Reads an ASCII DXF's drawing as line segments in metres for a reference under the plan. It covers LINE, LWPOLYLINE, POLYLINE with its vertices, CIRCLE and ARC (as 10° segments), from the ENTITIES section only. Units come from $INSUNITS, or a millimetre/metre guess. Other entities are counted as skipped. The result is set from the drawing's lower-left corner.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: entities read (ELLIPSE promised but not read: F-0092), units, texts/hatches/inserts counted, pure
- 6-17 DxfLines: flat segment list in metres from the lower left, size, origin, unit, skipped counts
- 19-20 UNITS: $INSUNITS codes for inches, feet, miles, mm, cm, m, km, yards
- 22-23 arcSteps: one segment every 10°, at least 4
- 25-30 readDxfLines: rows into (code, value) pairs; $INSUNITS from the header
- 31-45 seg (finite, non-zero) and arc (sweep made positive, segmented)
- 46-49 the ENTITIES section start (nothing when absent)
- 50-62 each entity's group codes up to the next 0; g() reads the first value of a code
- 63-66 LINE: 10/20 → 11/21 into one segment
- 67-74 LWPOLYLINE: vertices 10/20 as straight segments, closed flag 70 (bulges 42 ignored: F-0092)
- 75-90 POLYLINE: VERTEX entities up to SEQEND as straight segments (bulges ignored)
- 91-96 CIRCLE (full turn) and ARC (start and end angles in degrees, counter-clockwise; extrusion ignored)
- 97-103 SEQEND/VERTEX passed; anything else counted as skipped
- 104-114 bounding box of the segments
- 115-119 unit (stated, else mm when over 1000 units, else m); segments moved to the lower left and scaled; size, origin and unit

## Contracts, state and data flow
- Pure; ASCII DXF only (a binary DXF yields nothing). Blocks' INSERTs, SPLINE, ELLIPSE, TEXT and HATCH are skipped and counted.
- Arcs are approximated with 10° segments; polyline arcs are lost (F-0092).

## Depends on / used by
- uses: nothing
- used by: app/reference-ui.ts (DXF as a reference), elements/reference/schema (the dxf source)

## Problems found (finding IDs)
- F-0092 (S3): bulges, ellipses and mirrored arcs

## To check in other files
- src/app/reference-ui.ts: how the skipped counts are told to the user

## Sources
- https://ezdxf.readthedocs.io/en/stable/dxfentities/lwpolyline.html : LWPOLYLINE points carry a bulge; non-zero makes the segment from that vertex an arc; points are in the OCS of the extrusion (lines 67-90)
