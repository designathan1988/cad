# tests/elements/opening/held-by-wall.test.ts
Lines: 36
Summary: Tests that an opening placed or moved next to another is held by its wall. wallRule turns a fromOpening rule into fromStart or fromEnd at the same place. detachedFrom gives the openings measured from a moving door wall rules first, so moving the door leaves the window where it was. With nothing measured from the opening, detachedFrom returns the same list.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: held by the wall, never measured from the other (a promise opening-tool.ts ruleAt breaks: F-0068 Also)
- 4-9 imports: vitest, document, hostsIn, deriveOpenings, detachedFrom/wallRule, newOpening
- 11-15 an 8 m wall, door d fromStart 2, window k fromOpening d 1 toward the end (a module const named `window` shadowing the global), doc, `at` helper
- 17-22 wallRule gives fromStart or fromEnd and keeps k's start
- 24-30 detachedFrom d then d moved to 0.5: k stays where it was
- 32-35 detachedFrom k (nothing measured from it) returns the same array; suite closes (line 36 blank)

## Contracts, state and data flow
- detachedFrom and wallRule are the stopgap that holds dependents during a move (F-0068 Proof cites commands.ts:120-133). The header states the intended design. The placing tool still creates fromOpening links silently, so the stored rule kinds contradict it until the RC2 fix.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/opening (derive, commands, schema)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0068: the header's promise is not kept by the placing tool)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const : const is block-scoped; in a module a top-level const shadows a global name only in that module (line 13 `window`)
