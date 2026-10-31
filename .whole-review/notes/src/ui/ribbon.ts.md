# src/ui/ribbon.ts
Lines: 191
Summary: The ribbon renderer: types for items (action id, icon, large/small, short label, text, pressed, explains, menu), panels (title, items, field rows, redraw key) and tabs (contextual ones coloured apart); buttons built from the app's actions (label, key in the tooltip, aria-pressed, aria-disabled when unavailable, a click blurs to give the keys back to the drawing); split buttons opening a small menu; panels laid out large-per-column and small three-per-column; tab buttons with the chosen one scrolled into view.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: Revit's ribbon; every button an app action; what does not fit scrolls sideways
- 6-9 imports: Action type, el, i18n, icons
- 11-27 RibbonItem: id, icon, size, short, text, pressed, explains, menu
- 29-38 RibbonPanel: title, text, items, field rows (ribbonFieldRows), key
- 40-48 RibbonTab: id, title, text, context flag, panels
- 50-68 button: label (text, short or the action's), tooltip with the action's current key, aria-pressed; a menu item opens its list (aria-haspopup, aria-expanded, caret)
- 69-82 aria-disabled when unavailable and not pressed; click runs when enabled or explaining; a pointer click blurs the redrawn copy
- 84-99 openMenu: one menu at a time; close removes it and its document listeners; outside pointerdown closes
- 100-114 entries: menuitem buttons with icon and label, aria-current when pressed, aria-disabled; click closes and runs
- 115-126 keys: Escape closes and refocuses the anchor; Up/Down move (a third menu implementation: F-0125 Also)
- 127-139 placed under the anchor, kept inside on the right; listeners; first item focused
- 141-172 renderRibbonTab: per panel its field rows, then buttons (large alone, small in columns of three); empty panels dropped; panel role group with its title; the box labelled by the tab
- 174-190 renderRibbonTabs: File button then a role=tab button per tab (no arrows, no tabpanel link: F-0129); the chosen tab scrolled into view on narrow screens

## Contracts, state and data flow
- Pure DOM from the tab description and the action map; actions carry labels, keys (current keymap) and enabled state, so the ribbon's tooltips follow remapped keys.

## Depends on / used by
- uses: app/actions (Action type), ui/controls, ui/i18n, ui/icons
- used by: app/chrome.ts (renders tabs and the chosen tab from app/ribbon-tabs.ts)

## Problems found (finding IDs)
- F-0129 (S4): ARIA tabs without the tabs pattern
- F-0125 (Also): a third menu implementation

## To check in other files
- src/ui/shell.ts: the tablist element

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ : tablist/tab/tabpanel roles, aria-selected, aria-controls, Left/Right between tabs, Tab into the panel (lines 174-190, F-0129)
