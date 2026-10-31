# src/elements/material/physics.ts
Lines: 62
Summary: A material's physical data (moved here in step 1 from the removed simulation, as the owner asked): conductivity, density, specific heat, vapour resistance factor and Wi-Fi loss; the built-in materials' values with their sources; a material's own or the table's; the guard.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: NBR 15220-2 table B.3 (2003 draft, to confirm), ISO 10456 typical μ, Wi-Fi loss adopted from survey guides; pure
- 7 imports: Material type
- 9-20 MaterialPhysics: λ W/(m·K), ρ kg/m³, c kJ/(kg·K), μ, Wi-Fi dB at 2.4 GHz
- 22-48 DEFAULT_PHYSICS: plaster, brick, concrete, gypsum, insulation, wood, woodVeneer, metal, glass, tile, clayTile, screed, each with its source line
- 50-53 physicsOf: own, else by built-in id, else null
- 55 finite guard (another copy)
- 57-61 isPhysics: all finite; λ, ρ, c > 0; μ ≥ 1; Wi-Fi ≥ 0

## Contracts, state and data flow
- Data only now (no simulation reads it): shown and edited in the materials dialog; kept in files.

## Depends on / used by
- uses: elements/material/schema.ts (type)
- used by: ui/materials-dialog.ts, elements/material/commands.ts (isPhysics), schema.ts (type)

## Problems found (finding IDs)
- none

## To check in other files
- ui/materials-dialog.ts: physics fields still shown

## Sources
- https://en.wikipedia.org/wiki/Thermal_conductivity_and_resistivity : conductivity λ in W·m⁻¹·K⁻¹; materials span orders of magnitude (mineral wool low, metals high) (lines 9-20, 22-48)
