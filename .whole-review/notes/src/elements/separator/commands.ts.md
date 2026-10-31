# src/elements/separator/commands.ts
Lines: 11
Summary: The one command on room separators: add a separator.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: each returns a new document, one undo step
- 3-5 imports: Doc, Command and Separator types
- 7-10 addSeparator: a shallow copy of the doc with the separator appended

## Contracts, state and data flow
- Pure. Moving, transforming, copying and deleting separators go through the registry (registry.ts) with the separator kind's hooks.

## Depends on / used by
- uses: app/document (type), core/store (type), separator/schema (type)
- used by: the separator tool (app/kind-tools.ts)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax : object spread is a shallow copy; unchanged lists keep their identity (line 9)
