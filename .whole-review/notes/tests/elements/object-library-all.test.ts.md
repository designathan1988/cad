# tests/elements/object-library-all.test.ts
Lines: 53
Summary: Tests the whole built-in object library, per family and per type:
- no repeated ids;
- each definition is valid;
- every handle and every type value names one of the definition's own parameters;
- evaluating every type gives no problems, at least one piece, only built-in materials, nothing below −5 mm and no parts lost;
- setting any plain length parameter to 1 mm still loses no part, gives no problem and puts nothing below the floor.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: every family in every type closes and draws; a typo in a formula fails here
- 5-10 imports: vitest, BUILT_IN_MATERIALS, evaluateObject, LIBRARY, isDefinition, pieceSpan (two imports from one module)
- 12 evaluation context: the library and the built-in materials
- 14-18 duplicate ids found with an indexOf filter; the list must be empty
- 20-37 per family: validity and handles naming a parameter; per type, values naming parameters, no problems, some pieces, built-in materials only, lowest solid point above −0.005 (Math.min over the spread array), lost 0
- 39-50 per family and per plain length parameter (formula undefined) at 1 mm, in every type: lost 0, no problems, nothing below the floor
- 51-52 the family loop and the suite close (line 53 blank)

## Contracts, state and data flow
- The test proves that every formula closes and that sizes stay positive. It does not check meaning: the library defects found while reading (F-0061 to F-0065) all pass this test.
- If every piece is a cut, Math.min() of no arguments returns Infinity, so the lowest-point check passes trivially. A NaN bottom gives NaN, which fails toBeGreaterThan, as it should.

## Depends on / used by
- uses: src/elements/material/schema, src/elements/object (evaluate, library, valid)
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (F-0061 to F-0065 pass this test: it checks closure, not meaning)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/min : Math.min() with no arguments is Infinity; any NaN argument gives NaN (lines 33, 46)
- https://vitest.dev/api/expect.html : expect(value, message) takes a custom failure message as its second argument (lines 26-47)
