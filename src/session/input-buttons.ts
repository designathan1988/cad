// The interface's buttons (input.ts): the top bar, the tool bar, the 3D bar, the file, language and
// theme buttons. Each sends what it says to the app.

import { t } from '../i18n/messages';
import { setDrawing } from '../ui/drawing-dialog';
import { drawingOf } from '../project/doc';
import type { App } from './app';
import { EDIT_LEVELS } from './state';
import { showLevels } from '../ui/levels-dialog';
import { type MenuItem, showMenu } from '../ui/menu';
import { FILE_MENU } from '../ui/ribbon-tabs';
import type { LevelsShown, RenderQuality, VisualStyle } from './view/view-3d';
import { renameInPlace } from '../ui/rename-in-place';
import { showHelp } from '../ui/help-dialog';
import { setView, setView3D, toggleBox, toggleExplode } from './view-ui';
import { saveFile } from '../project/files';
import { resetTemporary } from './selection';
import * as appSettings from './app-settings';
import * as appEdit from './app-edit';
import * as appView from './app-view';

export function wireButtons(app: App, palette: () => void): void {
  const { shell, ui } = app;
  shell.undo.addEventListener('click', () => appEdit.undo(app));
  shell.redo.addEventListener('click', () => appEdit.redo(app));
  shell.homeBtn.addEventListener('click', () => app.openProjects());
  shell.view3d.addEventListener('click', () => setView(app, '3d'));
  shell.viewPlan.addEventListener('click', () => setView(app, 'plan'));
  shell.level.addEventListener('change', () => {
    if (shell.level.value === EDIT_LEVELS) {
      shell.level.value = ui.levelId;
      return showLevels(app);
    }
    appEdit.setLevel(app, shell.level.value);
  });
  shell.lang.addEventListener('click', () => appSettings.setLanguage(app, appSettings.otherLanguage()));
  shell.theme.addEventListener('click', () => appSettings.toggleTheme(app));
  shell.save.addEventListener('click', () => saveFile(app));
  shell.open.addEventListener('click', () => shell.fileInput.click());
  shell.projectName.addEventListener('click', () => renameInPlace(app));
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void appView.openFile(app, file);
  });
  shell.panelToggle.addEventListener('click', () => appSettings.togglePanel(app));
  // The File menu, under its tab: the project's files, help and settings (app/ribbon-tabs.ts).
  shell.fileMenu.addEventListener('click', () => {
    const actions = new Map(app.actionList().map((a) => [a.id, a]));
    const r = shell.fileMenu.getBoundingClientRect();
    let line = false;
    const items: MenuItem[] = [];
    for (const id of FILE_MENU) {
      if (id === '-') {
        line = items.length > 0;
        continue;
      }
      const a = actions.get(id);
      if (!a) continue;
      items.push({ label: a.label, ...(a.keys ? { keys: a.keys } : {}), disabled: !a.enabled, separated: line, run: a.run });
      line = false;
    }
    showMenu(items, { x: r.left, y: r.bottom + 2 }, t('rib.file'));
  });
  // The ribbon wider than the window: the mouse wheel scrolls it sideways, as Office's does.
  shell.ribbon.addEventListener(
    'wheel',
    (e) => {
      if (shell.ribbon.scrollWidth <= shell.ribbon.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      shell.ribbon.scrollLeft += e.deltaY;
    },
    { passive: false },
  );
  shell.snapBtn.addEventListener('click', () => appSettings.toggleSnaps(app));
  shell.collideBtn.addEventListener('click', () => appSettings.toggleCollisions(app));
  shell.toolDone.addEventListener('click', () => app.actionList().find((a) => a.id === 'tool.select')?.run());
  shell.snapParts.addEventListener('change', () => appSettings.setSnapParts(app, Number(shell.snapParts.value)));
  for (const [mode, b] of Object.entries(shell.levelsShown)) b.addEventListener('click', () => setView3D(app, { levels: mode as LevelsShown }));
  shell.explode.addEventListener('click', () => toggleExplode(app));
  shell.cut.addEventListener('click', () => setView3D(app, { cut: !ui.view3d.cut }));
  shell.xray.addEventListener('click', () => setView3D(app, { xray: !ui.view3d.xray }));
  shell.box.addEventListener('click', () => toggleBox(app));
  shell.ortho.addEventListener('click', () => setView3D(app, { ortho: !ui.view3d.ortho }));
  shell.look.style.select.addEventListener('change', () => {
    const style = shell.look.style.select.value as VisualStyle;
    // Said before it starts: the realistic view stays until the trace is clean, longer the first time on a
    // computer while the graphics card compiles the ray tracing (the browser keeps it after).
    if (style === 'photo') app.toast(t('view3d.photoFirst'));
    setView3D(app, { style });
  });
  shell.look.quality.select.addEventListener('change', () => setView3D(app, { quality: shell.look.quality.select.value as RenderQuality }));
  shell.planScale.select.addEventListener('change', () => app.store.dispatch(setDrawing({ ...drawingOf(app.store.get()), scale: Number(shell.planScale.select.value) })));
  // Visibility opens its popover (ui/visibility-panel.ts): the categories, the plan's marks, the overrides
  // and the combinations; the overrides' editor is one of its rows.
  shell.visBtn.addEventListener('click', () => {
    shell.visPanel.hidden = !shell.visPanel.hidden;
    shell.light.panel.hidden = true;
    app.renderChrome();
  });
  shell.shownReset.addEventListener('click', () => app.actionList().find((a) => a.id === 'view.tempReset')?.run());
  shell.light.button.addEventListener('click', () => {
    shell.light.panel.hidden = !shell.light.panel.hidden;
    shell.visPanel.hidden = true;
    app.renderChrome();
  });
  // The Display and Visibility panels are popovers: a click elsewhere or Esc closes them (the light's
  // stayed open over the drawing). A dialog opened from one (the overrides' editor) closes it too.
  const popovers = [shell.light.panel, shell.visPanel];
  const closePopovers = (keep?: Node) => {
    let changed = false;
    for (const p of popovers) {
      if (p.hidden || (keep && p.parentElement?.contains(keep))) continue;
      p.hidden = true;
      changed = true;
    }
    if (changed) app.renderChrome();
  };
  document.addEventListener('pointerdown', (e) => closePopovers(e.target instanceof Node ? e.target : undefined));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopovers();
  });
  shell.light.brightness.input.addEventListener('input', () => setView3D(app, { brightness: Number(shell.light.brightness.input.value) }));
  shell.light.sun.input.addEventListener('input', () => setView3D(app, { sun: Number(shell.light.sun.input.value) }));
  shell.tempReset.addEventListener('click', () => resetTemporary(app));
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.commands.addEventListener('click', () => palette());
}
