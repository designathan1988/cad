# src/elements/object/library-kit.ts
Lines: 75
Summary: Helpers the library's family files are written with: parameter groups, builders for each parameter kind (length on 5 mm steps, number, integer, counted and derived formulas, yes/no, choice, material), the box handles of an object centred on its origin, and bilingual words.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: metres; x along the width, y along the depth from the centre, z up; the front faces −y
- 5 imports: HandleDef, ParamDef, Words
- 7-14 Group pairs DIMENSIONS, BUILD, MATERIALS, LIGHT (LIGHT unused: library-decor.ts and library-equipment.ts write their own light() with w('Luz', 'Light')) and group()
- 16-26 len: a length in DIMENSIONS by default, step 5 mm
- 28-38 num: a number with its step, in BUILD
- 40-41 int: an integer with range
- 43-44 counted: an integer by formula (shown, not edited)
- 46-47 derived: a length by formula
- 49-50 yes: a bool 0/1
- 52-60 choice: options by index, the default index (defaults apply only when the argument is undefined)
- 62-63 mat: a material by id in MATERIALS
- 65-71 boxHandles: width both sides, depth at the front, height at the top
- 73-74 w: words in both languages

## Contracts, state and data flow
- Pure builders.

## Depends on / used by
- uses: elements/object/schema.ts (types)
- used by: every library-*.ts family file

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters : defaults used only for missing or undefined arguments (lines 17, 29, 41-53)
