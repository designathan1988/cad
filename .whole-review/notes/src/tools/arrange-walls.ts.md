# src/tools/arrange-walls.ts
Lines: 63
Summary: Aligning and distributing several straight parallel walls. Align moves the others across onto the first one's reference line; distribute keeps the two outermost and spaces the rest evenly between them in the order they lie across. Each wall moves across itself only through edit.ts moveWalls, one after another, so joins stretch the walls meeting them and openings go with their walls.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: align on the first one's line, distribute with equal axis spaces; moves keep joins like a drag; openings follow
- 6-8 imports: Doc/DocWall types, vector helpers, moveWalls from tools/edit
- 10-11 PARALLEL 1e-6: the sine below which directions count as parallel
- 13-19 parallelWalls: the walls in the ids' order; null with fewer than two, any arc, or any direction not parallel to the first
- 21-29 moveAcross: each move applied in turn on the walls as they stand after the previous one (moves under 1e-12 skipped)
- 31-32 canAlignWalls (≥ 2 parallel) and canDistributeWalls (≥ 3)
- 34-44 alignWalls: the first's normal; every other wall moved by minus its start's offset along that normal
- 46-62 distributeWalls: offsets across measured from the first; sorted (stable); the inner ones moved to lo + step·k

## Contracts, state and data flow
- Pure: returns the new walls list (or null), the caller dispatches it.
- Offsets are taken from each wall's reference line (start/end), not its faces, so walls of different thickness or reference side align by their reference lines.
- PARALLEL 1e-6 is strict: walls a hair off parallel (hand drawn without snaps) are refused, not aligned.

## Depends on / used by
- uses: app/document (types), core/vector, tools/edit (moveWalls)
- used by: app/frame.ts and elements/wall/fields.ts (the align/distribute actions and their enabled state)

## Problems found (finding IDs)
- none

## To check in other files
- src/tools/edit.ts: moveWalls keeps joins (the stretching of neighbours)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort : sort is stable since ES2019, so walls at equal offsets keep the selection's order; NaN compares as equal (lines 50-62)
