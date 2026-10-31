# tests/elements/measure.test.ts
Lines: 96
Summary: Tests of the special dimensions (phase 10): the smaller angle between two arms in degrees and a placed angle's clockwise sweep; on a half-circle arc wall of 2 m radius, the radius, diameter and arc length at the reference line and both faces (±7.5 cm); a measure held by its wall follows a new bulge and is gone when the wall is straight or deleted (dropKinds), while a free angle stays; derived again when only the wall changes; arcWallAt picks the arc under a click, its face and t; Portuguese texts (R 2,00, Ø 4,00, coordinate text) and a coordinate picked along its text; the DXF text (dead export, F-0047); file round trip, a bad measure left out.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: angular, radius, diameter, arc length and coordinate dimensions
- 4-12 imports: vitest, document, measure kind and texts, geometry, dropKinds, arcWallAt/placeMeasure, angleBetween/Measure, project file, setLang
- 14-17 the half-circle wall (bulge 1 = tan(π/4)), its doc, and a held-measure helper by type and face
- 19-26 angleBetween 90 and 135; a placed angle of 45° with sweep −π/4 (expect.closeTo inside toEqual)
- 28-37 radius 2, diameter 4, arc length 2π; faces 1.925 and 2.075 (sorted numerically by default sort of strings, which works here as both start "1." and "2.")
- 39-45 a quarter bulge tan(π/8) gives radius 2√2; a straight wall or no wall gives null
- 47-52 dropKinds on the wall's id removes the held measure and keeps the angle
- 54-59 deriveGeometry recomputes the value when only the wall's bulge changes
- 61-72 arcWallAt at the top of the arc: the wall, the reference face, t 0.5; 7 cm out is a face; the chord's middle is nothing
- 74-95 texts in pt; a coordinate hit along its label; DXF texts (%%c, Arco, %%d); write/read keeps three measures; a bad one is dropped; suite closes (line 95 closes the describe; 96 blank)

## Contracts, state and data flow
- Held measures are derived from the wall each time (no cache keyed by the measure alone).
- Line 34 sorts numbers with the default sort, which compares them as strings; correct here only because both values have one integer digit.

## Depends on / used by
- uses: src/app/document, src/app/geometry, src/elements/kinds/measure, src/elements/registry, src/elements/measure (place, schema), src/io/project-file, src/ui/i18n
- used by: the test runner (not run here)

## Problems found (finding IDs)
- F-0047 (Also: lines 83-86 pin the dead DXF text)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort : without a compare function elements are converted to strings and compared in UTF-16 order (line 34)
