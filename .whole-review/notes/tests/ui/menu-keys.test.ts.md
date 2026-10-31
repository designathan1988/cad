# tests/ui/menu-keys.test.ts
Lines: 47
Summary: Tests of a menu's keyboard behaviour, following the W3C APG menu pattern:
- the arrows move between items and wrap at both ends;
- disabled items can be focused but not run;
- Enter and Space run the focused item;
- Home and End go to the first and last items;
- Escape and Tab close the menu;
- a letter jumps to the next item starting with it, ignoring case and accents and wrapping round;
- other keys do nothing.
This module serves ui/menu.ts. objects-dialog and ribbon each build their own menus, where this behaviour is missing (F-0125).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: the APG menu pattern
- 4-5 imports: vitest, menuKey
- 7-12 four items, the third disabled
- 14-19 ArrowDown 0 → 1, 3 → 0 (wrap); ArrowUp 0 → 3
- 21-26 the disabled item is focused; Enter on it does not run; Enter and Space on item 1 run
- 28-33 Home → 0; End → 3; Escape and Tab close
- 35-41 'd' from 0 → 1, from 1 → 2 (the disabled 'Draw wall'), 'D' from 2 wraps to 1; 'e' finds 'Édition' (accents folded); 'q' matches nothing and stays
- 43-46 Shift → null; suite closes (line 47 blank)

## Contracts, state and data flow
- menuKey(items, index, key) is pure and returns the new index plus run/close flags, or null for keys it does not handle. It matches the APG behaviour: Tab closes the menu, and disabled items are focusable but not activated.

## Depends on / used by
- uses: src/ui/menu-keys
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none (the other menus without this behaviour: F-0125)

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ : menu keys: arrows (optionally wrapping), Home/End, Enter/Space, Escape, Tab closes, type-ahead, disabled items focusable (lines 1-45)
