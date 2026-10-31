# src/app/select-similar.ts
Lines: 18
Summary: Select similar (Revit's Select All Instances): the selection plus every element on the level shown that the registry's kinds call alike (similarKinds).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: walls by type, doors/windows by kind and size, rooms by use, floors by thickness, notes by letter height, guides all; pure
- 6-7 imports: similarKinds (registry), Doc type
- 9-17 similarTo: a Set seeded with the selection, the similar ids added; the list in insertion order (the selection first, then the registry's order: not "the document's order" as the doc comment says)

## Contracts, state and data flow
- Pure; the likeness rules live in each kind (contract.ts similar).

## Depends on / used by
- uses: elements/registry.ts (similarKinds), app/document.ts (type)
- used by: app/actions.ts (edit.selectSimilar): to confirm

## Problems found (finding IDs)
- none (the order wording is cosmetic)

## To check in other files
- elements/registry.ts similarKinds: level filter and kinds without a similar rule

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set : iteration in insertion order; adding a present value keeps its place (lines 11-16)
