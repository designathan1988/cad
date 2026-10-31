# tests/elements/wall/type-fields.test.ts
Lines: 57
Summary: Tests of a wall type's fields in its dialog: name, top and base, read from the type and written as one command each. Top at the level's height and a base offset of 0 are the defaults, and the type then stores neither. A fixed top shows its height and no offset. Setting a default value removes it from the type (undefined). Switching to "fixed" writes a height of 2.8 whatever the levels are (F-0139).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: one command per field; defaults are not stored
- 5-9 imports: vitest, wallTypeFields, WallTypePatch, WallType, fieldStates
- 11-21 a 20 cm brick type; run(): collects patches, maps field states by id, set() calls a field's setter
- 23-30 no top or base: top 'level', offset 0, base 0, no topHeight field
- 32-37 fixed 1.1: top 'fixed', topHeight 1.1, no topOffset field
- 39-56 the patches in order: level offset 0.3; top undefined; base −0.1; base undefined; fixed with height 2.8 (hard-coded: F-0139); name; suite closes (line 57 blank)

## Contracts, state and data flow
- Each field's setter sends one patch. undefined means the value is taken off the type. toEqual treats a key set to undefined the same as a missing key, so `{ top: undefined }` is compared loosely.

## Depends on / used by
- uses: src/elements/wall (type-fields, types, schema), src/ui/fields
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0139 (line 52 pins the hard-coded 2.8)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#toequal : toEqual does not check keys set to undefined; toStrictEqual does (lines 47-54)
