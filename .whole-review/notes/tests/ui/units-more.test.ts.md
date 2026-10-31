# tests/ui/units-more.test.ts
Lines: 80
Summary: Tests of the units added in phase 9:
- Feet and inches: shown as 12' 6", carrying 12 inches into a foot, with the inches' decimals and negatives handled. A project in feet writes its lengths that way and its areas in ft².
- Typed lengths: 12'6", 12' 6, 12ft 6in, 3ft, 8in, and mixed sums such as 2' + 450mm are read in any project. A bare number is read as feet in a project in feet.
- Angles are shown to the project's decimals (1 when not set).
- Slopes are shown and typed in percent, degrees or 1:n, converting back and forth, with 0 kept as 0.
- The file keeps these settings; isUnits refuses out-of-range values.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: feet and inches, ft², angle decimals, slope units, kept in the file
- 4-14 imports (vitest, parseLength, newDocument, project file, setLang, the units module); afterEach resets units and language
- 16-23 feetInches: 3.81 → 12' 6"; 3 ft less 0.1 mm → 3' 0"; 5.25 in → 0' 5.25"; −1 ft → -1' 0"
- 25-32 a project in ft: lengthText 12' 6"; areaText 1 m² → 10.76 ft²; back in metres 1.00 m²
- 34-44 parseLength of the feet/inch forms and a sum with mm; a bare 10 in a ft project → 3.048 m; suite closes
- 46-52 angleNum 33.7 by default; 33.690 with 3 decimals
- 54-68 slopes: percent shown as is; degrees: 100 % ↔ 45°; ratio: 8.33 % ↔ 1:12.0048, 12 ↔ 8.3333 %; 0 ↔ 0; suite closes
- 70-79 file round trip keeps {ft, 1, 2, ratio}; isUnits refuses angleDecimals 9 and slope 'grade'; suite closes (line 80 blank)

## Contracts, state and data flow
- The units module holds the project's display units as module state (setUnits), and every text function reads them. Slopes are stored as percent and converted for display and input (degrees = atan(p/100); ratio n = 100/p).

## Depends on / used by
- uses: src/core/measure, src/app/document, src/io/project-file, src/ui/i18n, src/ui/units
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Grade_(slope) : slope as angle, percentage (100 × rise/run, 45° = 100 %) or a ratio (lines 54-67)
