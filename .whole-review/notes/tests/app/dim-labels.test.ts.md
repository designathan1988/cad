# tests/app/dim-labels.test.ts
Lines: 37
Summary: Tests that temporary dimension values never overlap: apart ones stay at their lines' middles; crossing ones make the second slide along its own line until clear; on a line too short it steps off the line.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: values never on one another (the tester's P03, P06); slide along the line, else step off
- 5-6 imports: vitest, separateLabels
- 8 meets: two label boxes overlap
- 10-17 apart: the middles
- 19-27 crossing at the middles: the second moved along its own (vertical) line, not overlapping
- 29-35 a short line: stepped off, not overlapping
- 36 the suite closes

## Contracts, state and data flow
- Pure layout function over screen boxes.

## Depends on / used by
- uses: src/app/dim-labels
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/#describe : test/it define expectations; tests run sequentially unless concurrent (lines 10-36)
