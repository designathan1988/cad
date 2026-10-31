# src/elements/object/library-bath.ts
Lines: 267
Summary: Data: the library's bathroom definitions — vanity with basin (vessel, inset, carved; one or two; cabinet; mirror), bathtub (built-in, freestanding), glass shower enclosure (sliding, corner, walk-in), towel rail (bar, ring, heated ladder), mirror (rectangular, round, arch, LED), urinal, grab bars (straight, L, hinged, with an NBR 9050 height rule).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: data only; wall-hung pieces carry their height above the floor
- 5-6 imports: ObjectDefinition; library-kit helpers (boxHandles, BUILD, choice, len, mat, w, yes)
- 8-66 VANITY_SINK: parameters (basin kind, sizes, cabinet, two basins, mirror, materials); parts: counter, apron or cabinet with drawers and cut pulls, vessel (revolve and its cut), inset (rim, cut bowl, bottom), carved (thick block, tilted cut trough, drain slot), taps and levers per basin, mirror; types
- 68-101 BATHTUB: built-in (tiled box, rim) or freestanding (rounded tub), the basin cut, drain, fillers; types
- 103-137 SHOWER_GLASS: fixed and sliding panes, handle, return pane for the corner, top rail, wall profile, walk-in stabiliser, kerb, linear drain; types
- 139-170 TOWEL_RAIL: bar on posts with roses, ring (a disc with its middle cut), heated ladder (rungs every 7 cm: floor(altura/0.07)); a width handle; types
- 172-209 MIRROR: rectangular/arched frame and glass, round disc, LED glow; width and height handles; types
- 211-232 URINAL: body, cut bowl, flush valve; types standard and accessible
- 234-264 GRAB_BARS: the bar 4 cm clear of the wall, mounts, roses, the L's upright, the hinged plate and lower bar; a rule saying NBR 9050 asks 75 cm (70 to 80)
- 266 LIBRARY_BATH: the list

## Contracts, state and data flow
- Pure data, evaluated by evaluate.ts; cut parts rely on kinds/object.ts CSG.
- The NBR 9050 values (bar axis at 75 cm, Ø 3 to 4.5 cm, 4 cm from the wall) could not be confirmed against the standard's text (the found PDF is not readable; a public project cites 75 cm). Not a finding: to confirm with the edition in force.

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (type)
- used by: elements/object/library.ts (the built-in library)

## Problems found (finding IDs)
- none

## To check in other files
- library-kit.ts helpers

## Sources
- https://der.es.gov.br/Media/der/Documentos/Tabela%20Referencial%20de%20Preço/Referencial%20de%20Edificações/CADERNO_ESPECIFICACOES/1706-ACESSIBILIDADE%20-%20NBR%209050.pdf : opened to confirm the grab bar values; its text could not be extracted (lines 246, 263 left unconfirmed)
