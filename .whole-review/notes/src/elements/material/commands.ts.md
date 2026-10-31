# src/elements/material/commands.ts
Lines: 62
Summary: Material commands: add (usable and new id), update (name, colour, finish, cut pattern, surface pattern or physics, null to drop the last two; unusable or same → nothing), how many things use a material, why one cannot be deleted, delete.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: layers store the id, so a change repaints them all in one step; unusable values change nothing
- 6-11 imports: definitionMaterials, Doc, Command, isPattern, isPhysics, material schema
- 13-14 unit (0..1) and usable: colour, roughness, metalness, cut pattern, surface pattern, physics valid
- 16-19 addMaterial: usable and a new id; name trimmed
- 21-38 updateMaterial: the patch merged; pattern/physics null removes them, undefined keeps; name trimmed (?? keeps an empty patch name, then trimmed to ''); unusable or unchanged (JSON) → nothing. An empty name is accepted
- 40-49 materialUses: wall type layers, floor layers, rooms' finishes, object definitions — NOT roofs' coverings (roof/schema.ts covering.materialId) nor presets that name materials (presets.ts)
- 51-56 materialDeleteBlocker: missing, last, in use
- 58-61 deleteMaterial: only when nothing blocks it

## Contracts, state and data flow
- A material a roof is covered with counts as unused and can be deleted; the roof then falls back (materialIn) to another material (F-0058).

## Depends on / used by
- uses: elements/object/materials.ts, elements/material/pattern.ts, physics.ts, schema.ts, core/store.ts
- used by: ui/materials-dialog.ts

## Problems found (finding IDs)
- F-0058 materials used by roofs (and presets) count as unused

## To check in other files
- elements/material/schema.ts materialIn fallback; elements/presets.ts

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing : ?? falls back only for null/undefined ('' stays) (line 30)
