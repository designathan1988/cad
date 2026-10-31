# src/elements/object/schema.ts
Lines: 172
Summary: Types of parametric objects as data: words in two languages, parameter definitions, parts (box, cylinder, profile, revolve, sphere, mesh, nested object) with repeat/when/cut/material, handles, rules, types, the definition, imported mesh data, a light, and the instance placed in a project.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: the family as data (phase 3); an instance keeps a definition, a type and only its overrides
- 7 import: MaterialId
- 9-13 id prefixes 'object' and 'def'; DefinitionId and ObjectId aliases
- 15-19 Words: pt and en
- 21 ParamKind: length, number, integer, bool, choice, material
- 23-42 ParamDef: name, label, kind, default (id for a material, index for a choice), min, max, step, options, formula (calculated, shown), group, when (shown only when true)
- 44-46 Expr: number or formula string, in the object's axes
- 48-59 PartCommon: when (exists when not 0), repeat (count and per-copy dx, dy, dz; formulas see i), material (parameter name or id), name ("for the GLB and the panel": GLB export left the app, F-0047), cut (a void taken from the other parts)
- 61-91 Part union by `kind`: box (corner, size, round, tilt, roll, turn), cylinder (base centre, r, h, r2, tilt, roll, turn), profile (points extruded up), revolve (points (r; z) turned about the vertical), sphere (base centre, r, h, d, tilt, roll, turn), mesh (a definition's mesh stretched into a box), object (a nested definition at x, y, z, angle, values by formula)
- 93-103 HandleDef: param, axis, at (formulas), shift (how much the position follows), sign; no `when`
- 105-109 RuleDef: when and message
- 111-115 ObjectType: id, name, values
- 117 DefinitionCategory: seven categories
- 119-134 ObjectDefinition: id, name, category, folder, params, parts, handles, types, rules, light, meshes
- 136-146 MeshData: unit-box positions, indices, plan outline
- 148-154 LightDef: x, y, z, watts, kelvin
- 156-169 ObjectInstance: id, level, definition, type, plan centre, angle (radians CCW from +x), elevation, own values
- 171 MaterialRef alias

## Contracts, state and data flow
- Part is a discriminated union on `kind` (each member an intersection of PartCommon with a literal kind), so evaluate.ts narrows by switch.
- Instance values override type values, which override param defaults (comment 28, 160, 167).
- A param may be hidden by `when`; a handle may not (no `when` in HandleDef).
- A part's material is a plain string, never a formula.

## Depends on / used by
- uses: elements/material/schema.ts (MaterialId)
- used by: every elements/object/* file (evaluate, fields, commands, library files, materials), elements/kinds/object.ts, io/project-file.ts, io/import-mesh.ts, the object UI

## Problems found (finding IDs)
- none new; answers F-0063's check (params can have `when`, handles cannot) and F-0065's (material is not a formula). The "for the GLB" comment at 55 belongs with F-0047.

## To check in other files
- none

## Sources
- https://www.typescriptlang.org/docs/handbook/2/narrowing.html : discriminated unions narrow on a common literal property, also when each member is an intersection (lines 61-91)
