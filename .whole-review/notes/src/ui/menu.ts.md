# src/ui/menu.ts
Lines: 86
Summary: The short menu at a point (the right-click menu and the ribbon's split menus): role menu with menuitem buttons (icon, label, key text, aria-disabled, separators), keys from menu-keys.ts, pointer hover moves focus, a click runs; a click outside, Esc, Tab or a resize closes and focus returns to where it was. One menu at a time; placed inside the window.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 header: role menu, keys as menu-keys.ts, click runs, outside/Esc/Tab closes, focus back
- 4-6 imports: el, icons, menuKey
- 8-18 MenuItem: label, icon, keys shown at the right, disabled, separated, run
- 20 open: the close of the menu open now
- 22-27 showMenu: closes any other; nothing for no items; remembers the focused element; the menu element
- 28-41 items: menuitem buttons (tabindex -1), icon, key text, aria-disabled, separator class; click runs unless disabled
- 42-46 focus: the index and the button focused
- 47-62 keydown: propagation stopped; menuKey; close, run (closing first) or move
- 63 pointer hover focuses the item under it
- 64-73 outside pointerdown closes; close removes listeners and the menu, focus back
- 74-81 placed by its measured size inside the window (no max height: F-0123), listeners, open set
- 82-85 first focus: the first enabled item from `start`

## Contracts, state and data flow
- Module-level single open menu; items' run callbacks belong to the caller.

## Depends on / used by
- uses: ui/controls (el), ui/icons, ui/menu-keys
- used by: app/input.ts (context menu), app/input-buttons.ts (menus from buttons)

## Problems found (finding IDs)
- F-0123 (S4): no max height or scrolling

## To check in other files
- src/app/context-menu.ts: the items' keys text (F-0003)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menuitem_role : every menuitem focusable even when disabled, disabled via aria-disabled; arrow, Home, End keys (lines 28-46)
