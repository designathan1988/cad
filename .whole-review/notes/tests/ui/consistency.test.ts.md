# tests/ui/consistency.test.ts
Lines: 102
Summary: Tests that the same action has the same name and key everywhere (ref/chat.txt:200), in both languages, against the action list itself (app/actions.ts), which the ribbon, the title bar, the footer, the palette and the right-click menu read:
- each tool's tip (tipOf) is its palette name plus its key;
- the context menu and the palette name delete, frame and clear alike; Frame all's tip carries Home;
- the title bar's and the snaps button's tips are the palette names with their keys; the keyless buttons' tips are the palette names;
- the footer's select-all hint is the palette name in lower case;
- a key the user changes (a keymap) is the one the tip says, and one turned off is not said;
- Portuguese buttons start with a verb (:235).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: names and keys read from the action list, the same everywhere; a changed key changes everywhere; verbs first
- 6-13 imports: vitest, appActions/tipOf/Action, App type, newDocument, KeyMap type, createStore, setLang/t/MessageKey, VIEW_3D_DEFAULT
- 15-22 actions(keymap): the action list of a fake app (only what appActions reads) with that keymap, by id; tip(keymap, id) = tipOf of that action
- 24-31 six tools with their default keys (V, W, D, Shift+W, R, L)
- 33-50 per language (en, pt), resetting to en after each test: tool tips = "name (key)"; ctx.* = pal.*; view.frameAll's tip = "Frame all (Home)"
- 52-57 pt: the first words of eight buttons are verbs; suite closes
- 59-72 the title bar's and the snaps button's actions with their palette names and default keys
- 74-88 per language: each tip is "name (key)"; theme, panel and browser tips are the palette names; key.selectAll = pal.selectAll lower-cased
- 90-94 a remapped key (Ctrl+U for undo, G for snaps) is the tip's; a key turned off (null) leaves the name alone
- 96-101 pt: seven title bar buttons start with a verb; suite closes (line 102 blank)

## Contracts, state and data flow
- i18n module state (setLang) reset to en after each test. The keys checked come from appActions through keyOf and the given keymap, the same path the app takes (F-0010: the old test compared texts with keys written inside them).

## Depends on / used by
- uses: src/app/actions.ts, src/app/app (type), src/app/document.ts, src/app/keymap.ts (type), src/core/store.ts, src/ui/i18n.ts, src/app/view-3d.ts
- used by: the test runner (not run in this review)

## Problems found (finding IDs)
- none (F-0010 Also: the test now checks the action list and a remapped key)

## To check in other files
- none

## Sources
- https://vitest.dev/api/expect.html : toBe compares with Object.is (strings by value); the second argument of expect is a message shown on failure (line 77)
- https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html : the same function identified consistently (what the suite checks)
