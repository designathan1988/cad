# tests/elements/material-pattern.test.ts
Lines: 108
Summary: Tests of materials' surface patterns (phase 8). For every layout × tiles/wood/brick with no joint, one period is covered exactly once (sampled on a 97×97 grid off cell centres, with wrap-around). With a joint, gaps are left and pieces still never overlap. A herringbone's period and piece sizes are checked. A chequerboard alternates its colours and the others never do. Patterns out of range are refused by isPattern and isMaterial. updateMaterial sets, turns and removes a pattern and refuses a bad one. A version-29 file's built-in tiles, wood and brick gain their default patterns; a current file keeps a pattern the user took off.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: coverage once, ranges refused, older files get built-in patterns
- 5-9 imports: vitest, newDocument, updateMaterial, the pattern module, and isMaterial/readProject
- 11-32 coverage(): counts how many pieces cover each sample point, using a positive modulo ((x % p) + p) % p to wrap pieces across the period's edge
- 34-42 generated tests for every layout × kind: the set of counts is exactly {1}
- 44-50 with a 2 cm joint: the maximum count is 1 and some points are uncovered
- 52-57 herringbone with a 0.5 × 0.1 piece: period 1 × 1, 20 pieces, sizes 50x10 and 10x50
- 59-62 checker: 8 alternate pieces; the default tiles have none
- 64-74 isPattern refuses length 0, joint 0.2, an unknown layout, a non-hex colour and variation 2; isMaterial accepts the built-in tile and refuses width −1
- 76-88 updateMaterial: sets a pattern, turns it to 45°, refuses joint 1 (same doc returned), removes it with null, and leaves it alone when roughness changes
- 90-107 the version-29 migration: tile, wood and brick get their defaults; plaster and a user material get none; a current file keeps "no pattern"; suite closes (line 108 blank)

## Contracts, state and data flow
- Pure pattern geometry. The migration is keyed on the file version: below the version that introduced patterns, built-in ids get defaults.
- Line 78 wraps the finder in an extra function (`plaster()(d)`). It works but is needlessly curried; that is a style note only, not a finding.

## Depends on / used by
- uses: src/app/document, src/elements/material/commands, src/elements/material/pattern, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Remainder : % takes the dividend's sign; ((n % d) + d) % d is the positive modulo (lines 24-25)
- https://vitest.dev/api/expect.html#toequal : toEqual compares recursively by structure (lines 39, 56 compare Sets)
