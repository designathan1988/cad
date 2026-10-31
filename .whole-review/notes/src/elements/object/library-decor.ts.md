# src/elements/object/library-decor.ts
Lines: 400
Summary: Data: the library's lighting and decoration definitions — table lamp, arm chandelier, track with spotlights, suspended LED profile, outdoor wall light, articulated desk lamp, curtain, blind, framed pictures, decorative vase, large plant, wall clock, floating shelf with objects; each light with power (W of LED, about 100 lm/W) and colour temperature.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: data only; each light's power and colour temperature
- 6-7 imports: types; library-kit helpers
- 9-13 light(): power 1–200 W (0.5 W steps) and colour temperature 2200–6500 K
- 15-41 TABLE_LAMP: turned base, brass stem, drum shade; light inside the shade
- 43-73 CHANDELIER: canopy, rod, hub, arms turned 360/n each, sockets and globes placed by sin/cos; the light's watts × arms
- 75-101 TRACK_LIGHT: track, adapters, stems, tilted cans (spots by length); watts × spots
- 103-127 LED_PROFILE: profile, diffuser, two cables and canopies
- 129-151 OUTDOOR_WALL_LIGHT: body, lower and upper apertures; the type "Só para baixo, corten" in Portuguese is "Down only, copper" in English and uses copper (the Portuguese name says Corten steel: the two languages disagree)
- 153-180 DESK_LAMP: base, two arms by angle, joints, head; the light at the head
- 182-220 CURTAIN: rod, finials, pleats on both sides by how open it is, blackout
- 222-248 BLIND: roller and fabric by how raised, bottom bar; venetian headrail and slats every 2.5 cm
- 250-276 WALL_ART: one to three framed pictures with mat and artwork 8 cm apart
- 278-303 VASE: amphora, round or cylinder; five branches fanning out
- 305-342 LARGE_PLANT: pot; stems and leaf ellipsoids spread by a golden-angle-like turn (1.62 × 360/n)
- 344-370 WALL_CLOCK: rim, dial, twelve marks, hour and minute hands by the hour, pin
- 372-397 FLOATING_SHELF: shelf, books, small vase, candle, bowl (wide enough)
- 399 LIBRARY_DECOR: the list

## Contracts, state and data flow
- Pure data; lumens computed in evaluate.ts as 100 × W.

## Depends on / used by
- uses: elements/object/library-kit.ts, schema.ts (types)
- used by: elements/object/library.ts

## Problems found (finding IDs)
- none (one type's name differs between languages: corten vs copper, cosmetic)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Luminous_efficacy : LED lamps about 75–217 lm/W (the 100 lm/W assumption of line 4 is within range)
