# src/elements/registry.ts
Lines: 289
Summary: The registry of element kinds (contract.ts), in drawing and panel order, and the generic helpers the app uses over all of them: kind lookup, lists and levels, derivation with a per-element memo, filtering and iterating solids, a spatial index for picking, and moving, deleting (with holders and released followers), transforming, copying (with followers), re-levelling and appending pasted elements. Also lookup by grid line, "select similar", and "has any".

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: drawing/picking/panel order; generic helpers for shared code
- 4-30 imports: types (Doc, Point2, Transform, DerivedGeometry, FloorSolid, contract types), RTree and boxOf, the 20 kind objects
- 32-33 KINDS: drawing order, reference first, measure last
- 35-38 kindOfKey (non-null assertion) and kindOfId by id prefix
- 40-52 listOf (the doc's list for a kind), levelOfSolid, levelOfElement (every-level kinds, levelOf/levelIn hooks), withList
- 54-58 KindSolids type; WeakMap memo of each element's derivation and its level
- 60-80 deriveKinds: per kind and element, reuse the memo when the element object is the same (and its level object for memo 'level'), else derive; null drops it
- 82-92 filterKinds: keep by predicate; a kind losing nothing keeps its map identity (so drawings stay cached)
- 94-100 eachSolid generator: every solid with its kind, id and level
- 102-103 floorsOf: the floors' solids
- 105-130 kindsNear: an R-tree per derivation (WeakMap on the solids map) of boxes from extent or outlines; endless, grab and over-layer kinds always asked; query a box of `near` around p
- 132-139 solidsOf and hasSolid
- 141-153 moveKinds: move selected elements of every non-walled kind by d (doors go with their walls)
- 155-165 kindIds, kindLists, hasKinds
- 167-186 goesWith (own id or ANY holder deleted) and dropKinds: remove those, release followers of deleted elements (a room's floor keeps its outline); same doc when nothing changes (F-0056 Also)
- 188-193 KindTransform: going, doc before, geometry
- 195-208 mapKinds: kinds with `transformed` decide for every element (held ones go with their holders); others map the selected
- 210-248 copyKinds: what each kind copies (selected, going along, following what is copied); fresh ids first so copies refer to copies; transformed or mapped copies, `copied` hook; ids of the selected copies returned; each copy appended with an array spread (quadratic in the number of copies)
- 250-259 kindsOnLevel: elements appended after `before` put on a level
- 261-271 appendKinds: elements appended after `before` added to another doc (axes and doors excluded)
- 273-275 kindsOnLine: elements on an axis line (onGrid hook)
- 277-285 similarKinds: same level, similar to a selected one by the kind's `similar`
- 287-288 anyKinds: whether the document has any registry element

## Contracts, state and data flow
- Relies on immutability: an unchanged element is the same object, so the WeakMap memo holds (contract.ts memo). Memo keys are element objects; entries go with them (WeakMap does not keep keys alive).
- Deletion semantics: an element goes when any holder goes (dimensions, openings, measures, hosted railings). Zones declare none and are never removed with their rooms (F-0056).
- Walls are not a registry kind with the same helpers for openings: `walled` kinds (openings) are skipped by move/drop/map/copy and handled with their walls elsewhere.

## Depends on / used by
- uses: core/rtree, contract.ts, every elements/kinds/*.ts; types from app/document, app/geometry, tools/transform, room/derive
- used by: app/geometry.ts (deriveKinds), app.ts and input (picking via kindsNear), select-drag/modify tools (moveKinds, mapKinds, copyKinds), delete (opening/commands.ts deleteElements → dropKinds), clipboard (appendKinds, kindsOnLevel), grid/carry (kindsOnLine), select-similar, render (eachSolid, filterKinds)

## Problems found (finding IDs)
- F-0056 (Also): any-holder deletion rule; zones have no holders

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap : object keys held weakly, not iterable (lines 58, 108)
