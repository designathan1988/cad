# src/ui/units-dialog.ts
Lines: 74
Summary: The project's units dialog: length unit (m, cm, mm, ft-in; a new unit brings its usual decimals), decimals, angle decimals and slope format, each one command; a live sample of lengths and an angle in the chosen units; the setProjectUnits command (no-op when equal).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: length unit and decimals; one command; nothing drawn moves; a sample
- 5-11 imports: App, Doc, Command, controls, dialog, i18n, units helpers and constants
- 13-16 setProjectUnits: unchanged (JSON compare) leaves the doc
- 18-30 render: the length unit as a segmented choice (aria-pressed buttons: F-0133), its usual decimals on change, focus keys by label
- 31-38 decimals select (0 to MAX_DECIMALS)
- 39-47 angle decimals select
- 48-55 slope format segmented (%, °, 1:n)
- 56-58 the module units set to the project's; the sample of three lengths and an angle (role status)
- 59-62 row helper and Close
- 63-70 the dialog element: title, the four rows, sample, note, actions
- 71-73 opened; focus on the pressed unit

## Contracts, state and data flow
- Through openProjectDialog; setUnits keeps ui/units' module state in step with the document for the sample.

## Depends on / used by
- uses: core/store, ui/controls, ui/dialog, ui/i18n, ui/units
- used by: app (units action, browser's units line)

## Problems found (finding IDs)
- F-0133 (S4): one-of-n choices exposed as toggles

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed : aria-pressed marks a toggle button's own state, not one choice of a set (lines 22-28, 48-53)
