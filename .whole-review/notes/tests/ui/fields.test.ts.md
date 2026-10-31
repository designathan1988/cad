# tests/ui/fields.test.ts
Lines: 46
Summary: Tests that panels are built from each element's field list (ref/chat.txt:247). For one element, every field that applies shows with its value. For several, a common value shows, a differing value is null (shown as "varies"), and fields meant for one element only are left out. With no element, nothing shows.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: which fields show and the value each shows
- 4-5 imports: vitest, fieldStates/Field
- 7-18 a Box type and four fields: width (number), name (text, one only), onlyB (number when all are kind b), total (readout summing widths)
- 20-28 one kind-a box: width 2, name x, total '2' (onlyB hidden)
- 30-40 two kind-b boxes: width null (differs), onlyB null, total '5' (name hidden)
- 42-45 no element: []; suite closes (line 46 blank)

## Contracts, state and data flow
- fieldStates(fields, selection) filters fields with `when` and computes each value as the common value or null. It returns [] for an empty selection explicitly; otherwise a `when` built on every() would be vacuously true for none. This is the single field model RC1 asks the ribbon and float bar to share (F-0003, F-0030).

## Depends on / used by
- uses: src/ui/fields
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : every() is true for an empty array (line 16's `when`, lines 42-44)
