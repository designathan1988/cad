# src/elements/grid/commands.ts
Lines: 22
Summary: Grid axis commands: add an axis; rename one (trimmed, upper-cased; an empty name or one another axis has is refused, silently).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: commands on grid axes, each one undo step
- 3-5 imports: Doc, Command, Grid
- 7-10 addGrid: appended
- 12-21 renameGrid: name trimmed and upper-cased (locale-independent); empty or taken → unchanged (no message: the field shows the old name again); unchanged name → no step

## Contracts, state and data flow
- A refused rename returns the same document, so no step and nothing said: the panel shows the old name back (to check whether the field explains why).

## Depends on / used by
- uses: app/document.ts, core/store.ts, elements/grid/schema.ts (types)
- used by: app/kind-tools.ts (addGrid), grid fields (renameGrid)

## Problems found (finding IDs)
- none

## To check in other files
- the grid fields: feedback for a refused name

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toUpperCase : a new upper-case string, locale-independent (ß → SS lengthens) (line 16)
