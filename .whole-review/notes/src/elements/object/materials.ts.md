# src/elements/object/materials.ts
Lines: 17
Summary: definitionMaterials: the set of material ids a list of object definitions needs: their material parameters' defaults, the material values their types set, and ids their parts name directly (a part's material that is not a parameter's name).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: the materials objects use, kept among the project's materials so each can be edited
- 5 import: ObjectDefinition type
- 7-16 definitionMaterials: per definition, the material parameter names; defaults; type values for those names (Object.entries); part materials that are not parameter names

## Contracts, state and data flow
- Pure. A part's `material` is either a material parameter's name or a material id; the set tells them apart by the parameter names.
- Not covered: material ids passed literally in a nested object part's `values` (kind 'object'), which are neither defaults, types nor part materials.

## Depends on / used by
- uses: elements/object/schema.ts (type)
- used by: io/project-file.ts:348 (adds missing materials on reading), elements/material/commands.ts:49 (counts definitions using a material)

## Problems found (finding IDs)
- none

## To check in other files
- src/elements/object/schema.ts and the library files: whether a nested part's `values` ever carries a literal material id (it would be missed here and in material/commands.ts's use count).

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries : own enumerable string-keyed [key, value] pairs (line 12)
