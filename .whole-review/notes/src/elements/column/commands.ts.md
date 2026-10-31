# src/elements/column/commands.ts
Lines: 44
Summary: Column commands: add a column; update section, angle, top offset, shape, plate and the level its top reaches (null back to its own level's top) of several columns, refusing non-positive sizes and non-finite values, no step when nothing changes.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on columns, each one undo step
- 3-5 imports: Doc, Command, Column/ColumnShape
- 7-10 addColumn: appended
- 12-21 ColumnPatch: width, depth, angle, top offset, shape, plate, topLevelId (null: its own level's top)
- 23-29 updateColumns: sizes not above zero, non-finite angle/offset, plate not above zero → unchanged
- 30-36 per listed column: the patch's topLevelId apart; null drops the stored field; a value sets it (moved last); an empty string keeps the old one (falsy)
- 37-43 unchanged by JSON → kept (re-setting the same topLevelId moves the key to the end, so JSON differs and an empty undo step is made); a new document only when one changed

## Contracts, state and data flow
- topLevelId is not checked against the levels (a missing or lower level is left to the derivation).

## Depends on / used by
- uses: app/document.ts, core/store.ts, elements/column/schema.ts (types)
- used by: app/kind-tools.ts (addColumn), elements/column/fields.ts / kinds/column.ts (updateColumns)

## Problems found (finding IDs)
- none (an empty undo step on re-setting the same top level: cosmetic)

## To check in other files
- elements/kinds/column.ts: what a topLevelId of a missing or lower level derives to

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring : object rest is a new object of the own enumerable properties not picked (lines 34-35)
