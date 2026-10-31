# tests/elements/layers/stack.test.ts
Lines: 33
Summary: Tests of the layer stack operations (wall types and floors' build-ups): addLayer inserts a copy after the given layer; removeLayer never removes the last one; moveLayer moves within the list and returns the same list when the target is out of range; setLayer patches one layer; stackProblem reports noLayers, badThickness (zero or NaN) or null.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: one stack for wall types and floors' build-ups; each operation returns a new list
- 4-5 imports: vitest and the five stack operations
- 7-8 the layer helper (thickness, function, materialId) and a three-layer stack
- 10-13 addLayer after index 1 duplicates the structure layer
- 14-17 removeLayer removes the first; a single-layer stack is kept
- 18-22 moveLayer 2→0 reorders; out-of-range targets return the same array (toBe identity)
- 23-25 setLayer changes the middle thickness to 0.2 only
- 26-32 stackProblem: null, noLayers, badThickness for 0 and for NaN; suite closes (line 33 blank)

## Contracts, state and data flow
- Pure list operations; "no change" is signalled by returning the same array.
- Floors use this module's rule too since F-0136 (room/commands.ts setFloorLayers, kinds/floor.ts valid).

## Depends on / used by
- uses: src/elements/layers/stack
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0136 fixed (header line 1 no longer says "later")

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html : toBe is identity (Object.is), toEqual recursive structure (lines 20-21 vs 12-24)
