# tests/elements/wall/overrides.test.ts
Lines: 56
Summary: Tests of a wall's values taken from its type (ref/chat.txt:214):
- With no own values, a parapet type's fixed top of 1.10 m and its base offset of 0 apply.
- A type with no values gives the level's height and no offset.
- An own value that differs from the type's is an override; an equal one is not.
- Going back to the type removes the chosen own value only (top), in one undo step. A second reset changes nothing and returns the same document.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: own values, overrides, going back to the type
- 4-6 imports: vitest, document helpers (wallBase, wallHeights, wallOverrides, wallTop), resetWallsToType
- 8-15 a document with an extra parapet type (15 cm brick, fixed top 1.1, base 0)
- 16-24 wall helper with own fields
- 26-34 the parapet takes the type's top and base: heights 0 to 1.1, no overrides
- 36-39 a concrete type with no values: 0 to 2.8
- 41-45 own top 0.9 is an override; top 1.1 (equal) is not, base 0.2 is
- 47-55 reset ['top']: the top property is removed (object rest), base 0.2 kept; resetting again returns the same doc; suite closes (line 56 blank)

## Contracts, state and data flow
- Own values are optional fields on the wall. The override is computed by comparing them with the type's values. An own value equal to the type's stays stored and is not flagged; if the type changes later, it becomes an override silently. This is the same design as the type-or-own markers in fields.ts.

## Depends on / used by
- uses: src/app/document, src/elements/wall/commands
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring#rest_properties : rest properties copy the other own properties into a new object, leaving one out (line 51, top removed)
