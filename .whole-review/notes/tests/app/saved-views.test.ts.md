# tests/app/saved-views.test.ts
Lines: 76
Summary: Tests of saved views: next free names; save and delete one step each; the file round trip (an old file has none); malformed views and views of a missing level dropped and reported; rename and caption (the removed tour's), move up/down (the tour's order); a plan view's own drawing scale kept.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: names, the file, what is dropped
- 3-8 imports: vitest, newDocument, saved-view commands/guards, VIEW_3D_DEFAULT, detailOf, file read/write
- 10-11 a 3D view (x-ray on) and a plan view
- 13-18 nextViewName: the first free number of a kind
- 20-26 save and delete; an unknown id leaves the doc
- 28-33 round trip; a version 5 file has none
- 35-45 bad views refused; two dropped and two fixes reported
- 47-55 updateView name/caption (the tour's captions; only these tests call it: F-0036 Also)
- 57-63 moveView (the tour's order; only these tests call it: F-0036 Also)
- 65-74 a plan view's den, its detail, kept in the file
- 75 the suite closes

## Contracts, state and data flow
- Pure commands and guards; file round trips.

## Depends on / used by
- uses: src/app/document, src/app/saved-views, src/app/view-3d, src/elements/drawing/schema, src/io/project-file
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0036 (Also): the only callers of updateView and moveView

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html#tohaveproperty : .not.toHaveProperty passes when the key is absent (line 53)
