# tests/app/layer-sets.test.ts
Lines: 92
Summary: Tests of layer combinations (save/delete, validation, next free name), wall overrides (set, bad colour refused, cleared), the file keeping sets, overrides and a saved view's hidden categories, room overrides by use, and wall renovation phases (none until one has a phase; kept in the file; an unknown phase drops the wall).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: layer combinations, overrides and views that keep what they show
- 4-8 imports: vitest, newDocument, layer-set commands/guards, isSavedView, file read/write
- 10-29 layer sets: save and delete (field removed when empty), an unknown id leaves the doc; a set needs a name and known categories; nextName
- 31-40 wall overrides: set, colour read, a non-hex colour refused, cleared
- 42-62 the file keeps sets, overrides and a view's hidden/overrides; bad views refused; an old view without them still valid
- 64-73 room overrides: set, kept, unknown use refused, cleared
- 75-90 wall phases: none, then each wall's own; kept; an unknown phase leaves the wall out
- 91 the suite closes

## Contracts, state and data flow
- Pure commands and guards; file round trips.

## Depends on / used by
- uses: src/app/document, src/app/layer-sets, src/app/saved-views, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tobeundefined : asserts undefined (line 23)
