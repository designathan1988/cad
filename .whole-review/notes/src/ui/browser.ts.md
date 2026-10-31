# src/ui/browser.ts
Lines: 105
Summary: The project browser drawer: projects and units, levels (highest first, the current marked), views (3D, plan, saved views with delete, save, sections), layers (the categories of geometry.ts's CATEGORIES shown/hidden, reference lines, opening tags, saved layer sets with delete, overrides), and wall types (select the walls of a type on the shown level, with counts) plus the type and material dialogs. Re-rendered whole from the state; it only calls the app.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: levels, views, layers, wall types in a drawer; reads state, calls the app
- 4-10 imports: App type, typeUsage, CATEGORIES (geometry: the one list, F-0107), el/section, i18n name/t, icons, layerSwatch
- 12-23 item: a full-width button with optional lead icon HTML, label, trail text, aria-pressed, aria-current, disabled
- 25-33 savedItem: a saved view's row with its kind icon, optional scale, and a delete button
- 35-44 renderBrowser setup: close button, levels sorted by elevation (descending), type usage on the shown level
- 45-53 projects section: the projects dialog and the units summary
- 54-59 levels section: one row per level (current marked), the levels dialog
- 60-70 views section: 3D and plan (current marked), saved views (plan scale shown), save view, sections dialog
- 71-89 layers section: one row per category of CATEGORIES labelled layer.<category> (typed: a category without its message fails the type check) (aria-pressed, shown/hidden), reference lines, opening tags, layer sets (current when equal to the hidden set) with delete, save layer set, overrides
- 90-104 types section: each wall type with its swatch and count, disabled when walls are hidden or none use it; types and materials dialogs

## Contracts, state and data flow
- Rebuilt from scratch on each render (replaceChildren); every row's handler calls an App method.

## Depends on / used by
- uses: app/browser-data (typeUsage), app/geometry (CATEGORIES), ui/controls, ui/i18n, ui/icons, ui/swatch
- used by: app/chrome.ts (the browser drawer)

## Problems found (finding IDs)
- F-0107 fixed: the categories come from geometry.ts's one list

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current : aria-current marks the one current item of a set (true when no specific value fits); usable on buttons; aria-pressed is for toggles (lines 13-22, 57, 63-64, 74)
- https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html : (typeof list)[number] is the element type (Category from CATEGORIES)
