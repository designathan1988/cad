# src/core/guards.ts
Lines: 6
Summary: Shared type guards for data read from files: a non-null object, a finite number, a point with finite x and y.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: checks shared by the file reader and the kinds' validators
- 3 isObject: typeof "object" and not null (arrays pass too: typeof [] is "object")
- 4 finite: a number type and finite (no coercion)
- 5 isPoint: an object with finite x and y

## Contracts, state and data flow
- isObject does not exclude arrays: a validator that needs a plain object must add !Array.isArray. Other files keep their own copies of `finite` (saved-views.ts:93, section-box.ts readSection) instead of these.

## Depends on / used by
- uses: nothing
- used by: io/project-file.ts, elements' validators (kinds), app files: to confirm by import map

## Problems found (finding IDs)
- none

## To check in other files
- validators using isObject where an array would be wrong

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof : typeof null and typeof [] are "object" (line 3)
