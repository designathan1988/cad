# src/elements/opening/index.ts
Lines: 7
Summary: A barrel re-exporting the opening's schema, derive, commands and void modules. Nothing imports it.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: the element's public parts in one place
- 3-6 export * from schema, derive, commands and void

## Contracts, state and data flow
- Re-exports named exports only; a name exported by two of them would be dropped silently.

## Depends on / used by
- uses: opening/schema, derive, commands, void
- used by: nothing (searched src/ and tests/)

## Problems found (finding IDs)
- F-0070 (S4): unused barrel

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export : export * re-exports named exports, not the default; conflicting star exports are dropped (lines 3-6)
