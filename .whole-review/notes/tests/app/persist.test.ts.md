# tests/app/persist.test.ts
Lines: 45
Summary: Tests of validateDocument (the strict check of a stored document): one saved before openings loads with none; valid openings load as saved; any opening with a bad size, kind, rule or wall id makes the whole document refused (null).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: openings validated; old documents load with none
- 4-7 imports: vitest, newDocument, validateDocument, newOpening
- 9-16 a plain wall object
- 18-23 no openings field → []
- 25-29 a valid opening round-trips equal (typed ids already)
- 31-43 seven bad openings each refuse the document
- 44 the suite closes

## Contracts, state and data flow
- validateDocument is all-or-nothing (only typed-id renames tolerated), unlike readProject which drops bad elements and reports them.

## Depends on / used by
- uses: src/app/document, src/app/persist, src/elements/opening/schema
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse : JSON round trips deep-copy plain data (NaN would become null, undefined properties dropped) (lines 22, 28)
