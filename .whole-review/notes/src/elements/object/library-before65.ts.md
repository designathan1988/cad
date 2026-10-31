# src/elements/object/library-before65.ts
Lines: 591
Summary: Data for a file migration: the cooker, potted plant and vanity definitions as files before version 65 stored them, so the reader can replace an unchanged stored copy with today's and keep one the user edited.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the library definitions as files before version 65 hold them; one stored unchanged is replaced by today's, one the user changed is kept
- 4 imports: ObjectDefinition (type)
- 6-156 the old cooker definition: parameters (width, depth, height, burners, burners per row by formula, materials), parts (body, top, burners by row, oven door), four handles, two types (uniform: a JSON-like literal of one definition)
- 157-246 the old potted plant: parameters, parts (tapered pot, foliage sphere, three tufts placed by cos/sin of i·120°+30°), handles, one type
- 247-344 the old vanity with basin: id, names, folder and its parameters (basin kind, sizes, cabinet, two basins, mirror, materials)
- 345-400 its first parts (counter, apron, cabinet, drawers, the cut pulls)
- 401-542 the old vanity's other parts (uniform: one literal part object each, the same shape): vessel bowl and its cut, inset rim, cut bowl and bottom, carved block and its trough (tilt −6, 0.5 deep, unlike today's +5 and the depth-based one), spouts, levers, mirror
- 543-565 its four handles
- 566-590 its three types (vessel, two inset, carved) and the list's end

## Contracts, state and data flow
- Data only, read by io/project-file.ts to tell a stored built-in definition the user never changed (replaced by today's) from one the user changed (kept). How "unchanged" is decided matters: a JSON comparison depends on key order, so a definition written by an older app with keys in another order would count as changed and keep its old shape (to check in project-file.ts).

## Depends on / used by
- uses: elements/object/schema.ts (type)
- used by: io/project-file.ts (migration to v65)

## Problems found (finding IDs)
- none

## To check in other files
- io/project-file.ts: how a stored definition is compared with BEFORE_65

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify : output follows the object's key order, so equal objects with different key orders stringify differently (the comparison this table serves)
