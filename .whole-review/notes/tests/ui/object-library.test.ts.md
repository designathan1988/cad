# tests/ui/object-library.test.ts
Lines: 47
Summary: Tests of the objects library dialog's helpers (phase 4):
- An object sits in its own folder, or in its category's folder; a non-string folder is refused when the file is read.
- Search matches the name in either language or the folder, ignoring case and accents.
- The thumbnail of a 0.6 m box is one square filled in its material's colour, in a square view with 8 % margin. Every built-in definition has a thumbnail.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: search, folders, plan thumbnails
- 4-8 imports: vitest, newDocument, isDefinition, answers/blankDefinition/folderOf/thumbnailSvg, setLang
- 10-21 in pt, a blank definition's folder is 'Genérico'; an own folder 'Cozinha' is kept and valid; folder 3 is invalid
- 23-32 search on 'Mesa de jantar' / 'Dining table' / 'Sala': '' true, MESA, dining, sala true; cadeira false; 'armario' finds 'Armário'
- 34-46 thumbnail viewBox 0.696 × 0.696; one polygon; wood's colour; every built-in definition has a thumbnail; suite closes (line 46; 47 blank)

## Contracts, state and data flow
- Pure helpers exported from the dialog module. The language is set to pt and not reset (Vitest isolates files, and the third test does not depend on it). Accent folding follows the NFD-and-strip-marks method. Five store dialogs each have their own copy of this search folding (F-0126).

## Depends on / used by
- uses: src/app/document, src/elements/object/valid, src/ui/objects-dialog, src/ui/i18n
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none new (the duplicated folds: F-0126)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize : NFD splits accented letters so the marks can be removed (line 31, 'armario' finds 'Armário')
