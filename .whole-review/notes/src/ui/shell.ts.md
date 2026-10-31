# src/ui/shell.ts
Lines: 278
Summary: The window layout built once: title bar (projects, open, save, undo/redo, project name, command search with its key cap, shortcuts, language, theme, panel toggle), ribbon tabs and ribbon, the drawing (plan and 3D canvases, 3D overlay, temporary dimensions, floating bar, empty hint, temporary-hide chip, toast, project browser drawer, the view corner box with view buttons, level select and browser toggle), the view bar under the drawing (plan scale; 3D levels shown, explode/cut/x-ray/box/ortho, style, quality, light panel; visibility, show all, the tool's way out), the properties panel, the footer (tip, key hints, typed measure, snaps, snap parts, collisions, coordinates) and the dialog layer. Also the footer and view bar fitting by ResizeObserver, relabel() for the language, and keyHint.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: the window layout after Revit's; built once; relabel on language change
- 7-9 imports: el, i18n, icons
- 11-13 ToolId (27 tools) and ViewId
- 16-20 iconButton: a button with an icon (labelled later by relabel)
- 22-50 title bar: projects, open, save, undo, redo; project name button and saved note; command search with an empty key cap (app/chrome.ts writes the key the user set), shortcuts, language, theme, panel toggle, hidden file input
- 52-56 ribbon tabs (role tablist) with the File menu button, the ribbon (role toolbar: F-0129 Also)
- 57-76 the level select, Plan/3D view buttons, the browser toggle
- 78-79 the browser drawer (hidden)
- 81-96 viewport: plan and 3D canvases, overlay, temp dims, floating bar (toolbar), empty hint, toast (live), temporary-hide chip
- 97-114 view bar (toolbar): levels shown and the five 3D toggles as labelled icon buttons
- 115-126 style and quality selects with icons and captions; a "preparing" status
- 127-140 the light button and its panel of two range sliders
- 141-155 plan scale select, visibility button, show-all, groups for 3D-only and plan-only controls, the tool's way out
- 156-162 the view corner box (views, level, browser) and the viewport's children
- 164 the properties panel
- 166-178 footer: tip (live), key hints, typed measure with its label, snaps toggle, snap parts select, collisions toggle, coordinates
- 180-182 the dialog layer and the root's children (the layer last; the rest not made inert while it shows: F-0114)
- 184-199 fitFoot: hide key hints first-to-last until the tip fits; re-measured on text or width change (ResizeObserver)
- 201-217 fitViewBar: fit-1..3 classes added until the bar fits; keyed by width and contents; ResizeObserver
- 219-223 the parts exposed to the app
- 225-268 relabel: titles and aria-labels of the buttons without a key (projects, rename, theme, panel, browser, level, collisions), the search's words, the view buttons' words, tabs, ribbon, browser, levels, toggles, canvases, panel. The tips that carry a key (undo, redo, commands, shortcuts, language, save, open, snaps, Plan, 3D) and the empty hint are written by app/chrome.ts from the action list, with the key the user set (F-0010 fixed)
- 269-272 return and the Shell type
- 274-277 keyHint: a key cap and its words

## Contracts, state and data flow
- Builds DOM only; app/chrome.ts and frame.ts fill and update it. Icon-only buttons get names in relabel or chrome.ts (snap parts, visibility, show all, light, way out).

## Depends on / used by
- uses: ui/controls, ui/i18n, ui/icons
- used by: app/app.ts (buildShell), app/chrome.ts, app/frame.ts, app/input*.ts (parts), ui/cursors.ts (ToolId)

## Problems found (finding IDs)
- F-0010 fixed: no key is written here any more ('Ctrl K', '(1)', '(2)' and the top.* tips with keys moved to app/chrome.ts, read from the action list)
- F-0129 (Also): three role=toolbar groups without toolbar keys
- F-0114 (Also, context): the dialog layer is a sibling; nothing made inert

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ : a toolbar is one tab stop, arrows move between its controls; use it for three or more controls (lines 55, 85, 98)
