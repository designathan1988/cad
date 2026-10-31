# src/elements/railing/fields.ts
Lines: 32
Summary: The guardrail panel fields: height (from 0.30 m), base offset, infill (rails, balusters, glass), the gap between members as a readout, and the total length.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header: guardrail fields for ui/fields.ts
- 3-7 imports: lengthText, Field, RailingPatch, railing schema helpers, num and t
- 9-11 RailingFieldActions: updateRailings
- 13-17 railingFields: height (min 0.3) and base offset, set on all selected
- 18-27 infill segmented, default rails
- 28 gap readout: equal across the selection (every) or "varies"; written by hand in cm (F-0077)
- 29-31 total length readout through lengthText

## Contracts, state and data flow
- Data for ui/fields.ts; sets dispatch through the panel's actions. No "next railing" list here: railings follow next-element.ts's template.

## Depends on / used by
- uses: ui/units, ui/fields (type), ui/i18n, railing/commands (type), railing/schema
- used by: the railing kind's panel (elements/kinds/railing.ts) and next-element.ts for the next railing

## Problems found (finding IDs)
- F-0077 (S4): gap in cm whatever the unit

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every : every is true on an empty array, the callback never runs (line 28)
