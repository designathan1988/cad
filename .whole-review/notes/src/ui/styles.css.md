# src/ui/styles.css
Lines: 3251
Summary: The whole interface's stylesheet: design tokens (sizes, light and dark colours), the window grid (title bar, ribbon tabs, ribbon, drawing, view bar, footer; panel on the right), every component (segmented, selects, number fields, panel rows, footer, dialogs, palette, menus, search select, browser, tooltip, ribbon, view bar and corner box, view cube, the stores, the object editor, layer editor, levels, keys), breakpoints at 1100/900/720/600 px and 108/68/56/40 rem, coarse-pointer sizes and reduced motion. Dead rules and tokens of the removed areas remain (F-0131).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-99 (uniform: :root design tokens, one per line) font, type sizes, spacing, radii, chrome heights (top 40, tabs 30, ribbon 92, view bar 36, footer 36), ribbon sizes, store sizes, control heights, lines, component sizes; removed-area tokens kept (--stick/--stick-knob walk, --point-card-w points, --lot-col lot, --dialog-w-budget budget, --schedule-h schedules, --debug-w debug panel, --tour-w tour, --paper print preview); --dialog-w-xl defined twice (980px at 79, 860px at 83, the second wins)
- 101-173 (uniform: light colour tokens) surfaces, text, accent, scrim, 3D colours, materials shade, hatch, warn/error/ok ("the services' calculations"), snap, shadow, grid, axes, wall fill, phase colours (new red, demolish yellow), selection, kbd, floor, furniture, underlay, guide, reference line; color-scheme light
- 175-233 (uniform: dark theme overrides under [data-theme='dark']) the same tokens for dark
- 235-265 base: box-sizing, html/body (no scroll, font, tabular numbers), form fonts, focus-visible outline, icons take no pointer
- 267-274 #app grid: six rows (top, tabs, ribbon, drawing, view bar, footer), two columns (drawing, panel)
- 275-349 title bar: left/right flexible, centre, segmented views (comment about "Caminhar", the removed walk), project name button and its rename input, separators
- 351-400 icon buttons (hover, disabled and aria-disabled in .levels only, pressed), level warnings, text buttons, wide buttons in panel rows
- 401-450 wide buttons, panel notes, the custom select (native select without appearance, chevron icon), the 3D look selects
- 451-518 segmented control: buttons sharing the width, words-only buttons wrapping to two lines with clamp and hyphens, pressed, disabled; the 3D toggles' pressed look
- 522-590 viewport and its canvases (touch-action none), floating bar, temporary dimensions (buttons and inputs over the drawing)
- 591-645 the view bar under the drawing: fit-1..3 steps hiding captions then labels; preparing note; groups; separator
- 646-701 the light button and its slider panel opening upward; dimmed aria-disabled buttons
- 702-746 empty hint pill, the temporary hide/isolate frame and chip
- 747-779 .tour-hint/.tour-empty (removed tour's names, still used by projects and sections dialogs: F-0130), projects rows, danger text
- 800-907 (after its "View cube" comment) the view corner panel (fixed width so nothing moves between views), view box, view icons, level select, browser toggle, view cube (CSS 3D, preserve-3d, perspective, faces, focus and hover)
- 909-1100 (uniform: the properties panel's rules) panel and head, hints, collapsible sections (summary chevron rotating), two-column rows (label width token, controls shrink), wide and sub rows, field icons and two-line clamped labels, scrub cursor, number field with unit and absolute error under it, readouts, empty state, warning list
- 1102-1184 footer: tip with ellipsis, key hints, kbd caps, typed measure, snap box and parts select, coordinates
- 1186-1200 dialog backdrop: fixed scrim, top-anchored placement, z 20
- 1201-1250 dialog box (width token, max height with inner scroll), heading, definition lists, actions; the shortcuts dialog scrolling only its list
- 1252-1268 ≤1100 px: footer key hints hidden, tip on two lines (foot 48 px)
- 1269-1291 ≤900 px: one grid column, the panel a fixed drawer over the drawing between ribbon and view bar, shorter project name, icon-only segmented buttons, no coordinates
- 1292-1343 ≤600 px: smaller ribbon, panel titles and view labels hidden, title bar trimmed, the panel a bottom sheet (45%), footer tip on three lines (60 px)
- 1344-1373 coarse pointers: 44 px targets and taller chrome; phones with touch hide the project name
- 1374-1378 reduced motion: transitions off
- 1380-1413 marquee (window solid, crossing dashed) and the typed-measure tracker
- 1415-1478 command palette: fixed backdrop at 12 vh, input, list max height, options, disabled, status
- 1480-1539 right-click menu (fixed, no max height or overflow: F-0123), items, separators, focus, disabled, icons, keys; primary text button
- 1541-1600 search select button, swatches, search popup (fixed), its input
- 1601-1623 search popup list (max height) and options
- 1625-1693 project browser drawer (absolute at the viewport's left), rows with delete, items (current, pressed, hidden struck through), labels, trails
- 1695-1703 .sr-only: text read out but not shown
- 1705-1719 overridden fields with the accent bar
- 1721-1739 tooltip (fixed, max-content up to a limit, z 40)
- 1741-1748 dialog widths (.dialog-wide; .dialog-xl with a comment about the removed quantity schedules)
- 1749-1831 the list-and-detail dialogs (types, materials, objects): only the body scrolls, wrapping actions, list items, pressed, sticky detail and search
- 1832-1867 materials: chip, detail heading, two-column rows, colour input, units body
- 1868-1885 variables rows and add button
- 1886-1936 shortcuts dialog: top, search, scrolling list, rows, key buttons, changed mark, actions
- 1937-1945 .print-page (removed print area's name, used by the sections preview: F-0130)
- 1946-1955 notes and the physics sub-heading (F-0117)
- 1956-2000 .sheets-dialog/.sheet-* (the removed sheets' rules and comments about PDF buttons, now the sections dialog's: F-0130)
- 2001-2021 pressed sheet item, the section preview on paper colour, one column under 720 px
- 2022-2128 the layer editor: heading, stretched preview, grid of rows by named areas, captions only on phones, actions, foot and total; under 720 px the types dialog in one column and layer rows on two lines
- 2129-2145 levels grid and heads (narrow variant)
- 2146-2193 removed areas' rules: .rules (the norms dialog), .approval-done/.approval-na, .lot-areas table, .rules checkboxes (F-0131)
- 2194-2214 text fields and textareas, dialog action spacer
- 2216-2319 the dark title bar: its tokens (dark variant), buttons, separators, saved note with a green dot, the app mark in the accent, the command search button and its key cap
- 2321-2374 ribbon tabs (scrolling, no scrollbar), tab, selected (border-bottom-color on a borderless tab does nothing), the File button in the accent, the contextual tab
- 2376-2400 ribbon (scrolls sideways, no scrollbar), panels, panel bodies
- 2401-2463 ribbon columns, panel titles, large and small buttons (two-line clamped labels), hover, pressed, aria-disabled dimmed
- 2464-2525 ribbon field rows (a tool's next element: three rows per column, label and control widths, narrower under 108rem, segmented choices on one line)
- 2526-2570 split-button caret and its menu (fixed, items, current, disabled)
- 2572-2611 view bar spacer, the tool's way out, view tabs and the browser toggle (comment still says they are on the view bar; they moved to the corner box)
- 2612-2623 grid placement of viewport, panel (rows 4-5) and footer
- 2624-2633 coarse pointers: ribbon columns become rows; two field rows
- 2635-2829 (uniform: the object editor's rules) dialog width, name row, two columns, tabs, scrolling body, tables for params/handles/rules, points textarea, void box, inputs and selects, part cards and their head, cell grid, add buttons, preview canvas, sliders, status; one column under 900 px
- 2831-2850 the objects store: fixed size within the window, head
- 2851-2913 store head: title, pill search, total, the library menu (absolute) and its items
- 2914-3067 (uniform: the store layout) three columns (folders, cards, side), folder nav with counts, auto-fill card grid, cards (hover, pressed), 4:3 pictures with an opacity pulse while loading, badge, names, empty message, the side panel
- 3068-3096 variants: the wall types store's wider side, the floor store without folders and its layer list, the 16:9 type preview
- 3097-3202 side panel: preview, name, folder line, dimension tiles, type chips (radio), the main Place button, notes, side actions
- 3203-3250 responsive stores: folders hidden under 68rem, narrower side under 56rem, one column with the chosen one first and two-column cards under 40rem
- 780-798 toast (over dialogs at z 25; its comment mentions "CSV saved", the removed exports)

## Contracts, state and data flow
- Sizes and colours come from tokens (no raw px outside :root, as the project's rule asks); the theme switches by [data-theme='dark'] on the root; the app toggles classes (fit-N, temp-view, hidden attributes).

## Depends on / used by
- uses: nothing (plain CSS, the Inter font named first)
- used by: index (imported once), every ui and app module through class names

## Problems found (finding IDs)
- F-0131 (S4): removed areas' rules, tokens, comments; --dialog-w-xl twice
- F-0123: .menu without max height
- F-0130: sheet/print/tour class names used by the sections and projects dialogs
- F-0117: the physics sub-heading's rule

## To check in other files
- src/app/geometry.ts:71: comment pointing at the removed app/lot-areas.ts

## Sources
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion : reduce asks to remove, reduce or replace motion; an opacity dissolve is the page's gentle alternative (lines 1374-1378, 3017-3025)
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/color : the colour inputs styled at 1856-1864 report on change
