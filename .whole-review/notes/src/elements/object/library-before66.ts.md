# src/elements/object/library-before66.ts
Lines: 690
Summary: Data for a file migration: the bookcase, fridge, tree and oven tower definitions as files before version 66 stored them, so an unchanged stored copy is replaced by today's and an edited one kept.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: library definitions as files before version 66 hold them; unchanged ones replaced, changed ones kept
- 4 imports: ObjectDefinition (type)
- 6-84 the old bookcase: id, names, category; parameters (width, depth, height, board thickness, shelf spacing, back, shelves by formula, material)
- 85-134 its parts: sides, base and top, back, shelves spread evenly
- 135-184 its four handles, three types, a sagging-shelf rule (over 90 cm)
- 185-244 the old fridge: parameters (sizes, freezer height, materials)
- 245-330 its parts (body, lower and freezer doors, two handles), handles, two types
- 331-390 the old tree: parameters (crown diameter, height, trunk diameter, clear trunk, materials)
- 391-445 its parts: a tapering trunk and crown spheres (main, six sides by cos/sin of i·60°+20°, three upper, top)
- 446-467 its two handles and two types
- 468-528 the old oven tower: id, names, folder, parameters (sizes, oven height, materials)
- 529-652 its parts (uniform: one literal box or cylinder each — carcass, lower door, oven, window, handle, controls, knobs, microwave and window, upper door, plinth)
- 653-689 its handles, two types and the list's end

## Contracts, state and data flow
- Data for io/project-file.ts's v66 migration (same use as library-before65.ts). Exported as a const array typed readonly; const only fixes the binding, TypeScript's readonly keeps code from changing it.

## Depends on / used by
- uses: elements/object/schema.ts (type)
- used by: io/project-file.ts (migration to v66)

## Problems found (finding IDs)
- none

## To check in other files
- io/project-file.ts: comparison of stored definitions with this table

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const : const fixes the binding, not the value (line 6)
