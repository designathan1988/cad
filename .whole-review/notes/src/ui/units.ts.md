# src/ui/units.ts
Lines: 153
Summary: The project's display units: length unit (m, cm, mm, ft-in) and decimals, angle decimals, slope format (percent, degrees, 1:n), validated by isUnits; module state set from the open project (also telling core/measure what a bare number means); formatting of lengths (with or without the unit, feet and inches), areas (m² or ft²), volumes, angles, slopes shown and typed back, unit conversion, and the typing examples used by hints.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: metres inside; units only change what is written and read; m²/m³ or ft²/ft³
- 7-8 imports: setBareUnit, getLang and num
- 10-15 LengthUnit and SlopeFormat lists
- 17-27 Units (length, decimals, angle decimals, slope) and DEFAULT_UNITS
- 29-32 USUAL_DECIMALS per unit, MAX_DECIMALS 4, MAX_ANGLE_DECIMALS 3
- 34-38 SCALE per unit (ft 0.3048), INCH 0.0254, FT2 and FT3 factors
- 40-52 isUnits: unit in the list, integer decimals in range, optional angle decimals and slope checked
- 54-64 current units; setUnits (also the bare unit for parsing); getters
- 66-73 decimalsFor: the project's decimals or more when a finer metre step is asked
- 75-87 feetInches: rounded inches, feet split, carry at 12, the sign
- 89-94 lengthNum and lengthText (feet-inches carry their own marks)
- 96-103 areaText, volumeText, angleNum
- 105-125 slope format and unit; slopeShown (degrees by atan, ratio 100/percent, level 0) and slopeTyped back (degrees clamped to 0–89.9: F-0080 Also stands)
- 127-131 toUnit and unitScale
- 133-152 typed and typedAlt (examples in the project's unit and the other way) and typingExamples

## Contracts, state and data flow
- Module state, set by chrome.ts from the document; every formatter reads it. Inside values are always metres and percent.

## Depends on / used by
- uses: core/measure (setBareUnit), ui/i18n (num, getLang)
- used by: ui/controls, fields, dialogs, app/chrome.ts, app/frame.ts, render (labels), elements' fields (text of lengths, slopes)

## Problems found (finding IDs)
- none (F-0044's check: the typing examples show no × or ÷)

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Foot_(unit) : the international foot is exactly 0.3048 m and the inch 0.0254 m (lines 34-38)
