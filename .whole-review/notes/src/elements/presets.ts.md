# src/elements/presets.ts
Lines: 59
Summary: Ready-made models for columns, beams, stairs, railings, roofs and curtain walls. Each is a name plus an untyped patch merged into the tool's next element by the presets dialog.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: models for kinds without types; set on the next element; shown pictured by the store dialog
- 5-6 imports: Words; edgesFor and RoofKind
- 8-15 PresetSlot (six slots) and Preset (id, slot, name, untyped patch)
- 17 w(): bilingual words for the preset names
- 19-20 PRESET_TOOL: the tool each slot is placed with
- 22-24 SQUARE (6 × 6 m) and roof(): kind, edges from edgesFor on the square, extras
- 26-33 columns: concrete 25×25, 20×40, 40×40, round Ø30, steel I, H, L with plate thickness
- 34-38 beams: concrete 15×40, 20×50, 20×60, ground beam 12×30, steel I 15×30
- 39-44 stairs: straight 1.00 and 1.20, L, U, spiral 0.80, accessible ramp 1.20 m at 8.33 %
- 45-47 railings at 1.10 m: balusters, horizontal rails, glass
- 48-52 roofs: hip 30 %, gable 35 %, steep gable 45 % "slate" (graniteBlack), shed 10 % metal, flat slab with 0.9 m parapet
- 53-56 curtain walls: glass skin 1.25 m modules, storefront, slim frame, opaque panels
- 57-58 a stair railing at 0.90 m, out of the railings' order; the list closes

## Contracts, state and data flow
- Pure data. ui/presets-dialog.ts:29 spreads `patch` over the slot's next element, with no key or value check (F-0076).
- Roof presets carry material ids for their coverings (F-0058 Also).
- The ramp's 8.33 % is NBR 9050's usual maximum (1:12) and its 1.20 m width the minimum allowed.

## Depends on / used by
- uses: object/schema (Words), roof/schema (edgesFor, RoofKind)
- used by: ui/presets-dialog.ts (the store)

## Problems found (finding IDs)
- F-0076 (S4): untyped patches; slate preset uses granite; railings split
- F-0058 (Also): preset roof materials not counted as uses

## To check in other files
- src/app/next-element.ts: the next element types per slot (F-0076 fix)

## Sources
- https://sienge.com.br/blog/como-projetar-e-calcular-uma-rampa/ : NBR 9050 ramps at most 8.33 % (1:12) in usual cases, minimum width 1.20 m (line 44)
