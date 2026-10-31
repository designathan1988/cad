# The task in hand: its notebook (printed whole at every session start and compaction by `.claude/hooks/printfile.cjs`)

Rewrite this file when a task starts: the owner's order word for word, how the work is done, and the steps. Then, after every step:
what was read (files and lines), what was found (file:line), what was changed, the commit, and what is next. Keep it under 9,000
characters: what is done moves to `docs/agent/history.md`.

## 2026-10-31, owner: "ENTÃO TERMINA E TESTA A APLICAÇÃO NO NAVEGADOR."
Left after the merge: main's open findings F-0072 (single sliding leaf never opens; shutter vanishes), F-0089 (straight walls
overlapping with no contact unreported), F-0091 (wall type layer order unchecked), F-0097 (typed-ids renames; IN PROGRESS
uncommitted in the main checkout by another session: not duplicated here), F-0023 rest and F-0138 (main left/blocked), mirrored
wall over a column with no warning. Test map (headless drive.cjs, 1920x1080, then 1280; never 880): file (new, open, download,
projects), levels, walls (line, rect, arc, split, merge, corner, flip, align, distribute, types), openings (place, slide, handles,
flip, groups, distribute), rooms/floors/ceilings/zones, roof (L hip), stair, railing, column, beam, curtain, separator, dims
(linear, angle, radius, coord, level mark), measure (chain, crossing), guides, grid, sections/elevations, references, objects
(store, editor, handles), materials, presets, overrides, layer sets, saved views, 3D (styles, box, explode, cut, xray), keys,
help, palette, language, theme, panel, browser. Then fix what is found; then F-0072, F-0089, F-0091, wall over column.

## 2026-10-31, owner (mid-task): implement the prototype "cad2 — barra superior fixa (comandos gerais) e painel flutuante da
ferramenta" (Desktop zip, Toolbar4.dc.html, read whole; extracted to scratchpad/proto) "E GARANTA QUE FIQUE FUNCIONAL E NÃO QUEBRE NADA".
Layout: title 30 (logo, Projeto menu, undo/redo, name · saved, Comandos Ctrl K 220px); fixed command bar 32 (general commands, off when
not applicable); viewport: view header top-left (Plan/3D, level menu + new/edit, scale), tool rail left (icon groups, families with
caret), nav right (cube 3D, fit), context panel top centre (tool ways/stores or element actions + Terminar Esc), view bar bottom
(3D toggles + Exibição, plan scale, Visibilidade); right: one panel at a time + 30px icon bar; status 22 (prompt, coords, Encaixe,
÷ N, Colisão). Dark tokens = prototype colours. Ribbon and float bar go. Mapping of every command:
Projeto menu: file.new/projects/open/save | ref.import, model.import | units.edit, settings.variables, settings.keys, drawing.edit
| view.elevation.n/s/e/w | settings.language, settings.theme, help.shortcuts. Fixed bar: edit.move/copy/rotate/mirror/scale |
edit.copyClip, edit.paste | view.tempHide/tempIsolate | edit.selectAll, select walls, edit.selectSimilar, view.frameSelection,
edit.clearSelection, edit.delete. Rail: select, measure | wall(line/rect/arc), door, window, curtain, floor(floor/ceiling),
room(room/separator), roof, stair(stair/railing) | column, beam, grid | object(list+library+import) | dimension(linear/angle/radius/
levelMark/coord), note(text/callout), section, guide(line/point/circle). Context panel: tool ways + stores + Terminar; selection:
ELEMENT_ACTIONS, offset, geometry family (split/corner/merge), zone.make, arrange family. Nav: cube, view.frameAll. View bar: as now
(+ view.sectionOff while a 3D section is on). Right bar: properties, browser (views, sections, wall types), library, materials.
Not built (no such feature: memory finish-before-new): Avisos panel, Zoom/Pan buttons.

### Interface progress (2026-10-31)
- 8e59330 the frame: shell.ts rebuilt; ui/bars.ts (BarItem, barButton, families via ui/menu.ts showMenu, drawBar by key),
  command-bar.ts, tool-rail.ts (listedObjects, objectFamily, railGroups), context-panel.ts (actionsWithContext, toolItems,
  selectionItems, placeName, lowerFirst), project-menu.ts, view-header.ts (header, level menu, side bar); styles/bars.css;
  ribbon*.ts, float-bar.ts, bar-place.ts, ribbon.css removed; menu.ts gets group headings and `current`; browser.ts trimmed to
  saved views + wall types; one right panel at a time (togglePanel/toggleBrowser); covered() reads panel or browser on the right.
- ada446b element actions from menuEntries (contextEntries removed), wand icon for dim.auto, navigator title class, stale texts.
- c345ff4 owner: "ESSA APLICAÇÃO NÃO É PARA MOBILE" / "VAI TESTAR EM 880 POR QUE": phone, touch and narrow-drawing CSS removed;
  memories desktop-only + test-window-sizes now say 1920 and 1280 only.
- Checked headless at 1920 (light and dark) and 1280: Project menu, level menu + level editor, rail, object list, wall tool panel,
  dimension family, wall and door selection panels, Move from the fixed bar, W wall + Ctrl+Z, language switch, 3D (cube, frame
  all, display popover), navigator, library, visibility, palette. Console clean.
- Then (goal "termine tudo"): F-0072 + F-0089 + F-0091 e297fed, test fixes d7d79dc, F-0097 30cd3a9; all checked in the app at 1920.
