# src/ui/menu-keys.ts
Lines: 39
Summary: The keyboard of a menu as the WAI-ARIA APG menu pattern describes it, as a pure function: arrows wrap, Home/End, Enter/Space run the item unless disabled, Escape/Tab close, a printable character jumps to the next item whose label starts with it (accent-folded).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the APG menu pattern; pure, testable without a page
- 4 import: fold (accent and case folding, ui/search)
- 6-10 MenuKeyResult: the focused index, run, close
- 12-29 menuKey: ArrowDown/Up wrapping, Home, End, Enter/Space (disabled items focusable but not run), Escape and Tab close
- 30-38 typeahead: other multi-character keys ignored (null); the next item after this one whose folded label starts with the folded letter; else stay

## Contracts, state and data flow
- Pure; the caller (ui/menu.ts) moves focus and runs or closes. With no items the arrow arithmetic gives NaN (callers never open an empty menu).

## Depends on / used by
- uses: ui/search (fold)
- used by: ui/menu.ts (context menu and menus), ui/ribbon.ts (split-button menus) via menu.ts

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ : menu keys (Down/Up wrap, Home/End, Enter activates and closes, Space optional, Tab/Escape close, typeahead optional); disabled items focusable but not activated (lines 12-38)
