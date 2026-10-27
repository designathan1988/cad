// The interface's buttons (input.ts): the top bar, the tool bar, the 3D bar, the tour and point cards,
// the file, language and theme buttons. Each sends what it says to the app.

import { t } from '../ui/i18n';
import { setDrawing } from '../ui/print-dialog';
import { drawingOf } from './document';
import type { App } from './app';
import { EDIT_LEVELS } from './app';
import { showLevels } from '../ui/levels-dialog';
import { type MenuItem, showMenu } from '../ui/menu';
import { FILE_MENU } from './ribbon-tabs';
import type { LevelsShown, RenderQuality, VisualStyle } from './view-3d';
import { renameInPlace, showHelp } from './input';

export function wireButtons(app: App, palette: () => void): void {
  const { shell, ui } = app;
  shell.undo.addEventListener('click', () => app.undo());
  shell.redo.addEventListener('click', () => app.redo());
  shell.homeBtn.addEventListener('click', () => app.openProjects());
  shell.view3d.addEventListener('click', () => app.setView('3d'));
  shell.viewWalk.addEventListener('click', () => app.toggleWalk());
  shell.tourPrev.addEventListener('click', () => app.tourStep(-1));
  shell.tourNext.addEventListener('click', () => app.tourStep(1));
  shell.tourPlay.addEventListener('click', () => app.tourPause());
  shell.tourStop.addEventListener('click', () => app.stopTour());
  shell.pointClose.addEventListener('click', () => app.showPoint(null));
  shell.pointEdit.addEventListener('click', () => app.openPoints());
  // The walking stick: pushed up walks forward, sideways steps aside, as far as it is pushed.
  shell.viewPlan.addEventListener('click', () => app.setView('plan'));
  shell.level.addEventListener('change', () => {
    if (shell.level.value === EDIT_LEVELS) {
      shell.level.value = ui.levelId;
      return showLevels(app);
    }
    app.setLevel(shell.level.value);
  });
  shell.lang.addEventListener('click', () => app.setLanguage(app.otherLanguage()));
  shell.theme.addEventListener('click', () => app.toggleTheme());
  shell.save.addEventListener('click', () => app.saveFile());
  shell.open.addEventListener('click', () => shell.fileInput.click());
  shell.projectName.addEventListener('click', () => renameInPlace(app));
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void app.openFile(file);
  });
  shell.panelToggle.addEventListener('click', () => app.togglePanel());
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
  shell.snapBtn.addEventListener('click', () => app.toggleSnaps());
  shell.toolDone.addEventListener('click', () => app.actionList().find((a) => a.id === 'tool.select')?.run());
  shell.snapParts.addEventListener('change', () => app.setSnapParts(Number(shell.snapParts.value)));
  for (const [mode, b] of Object.entries(shell.levelsShown)) b.addEventListener('click', () => app.setView3D({ levels: mode as LevelsShown }));
  shell.explode.addEventListener('click', () => app.toggleExplode());
  shell.cut.addEventListener('click', () => app.setView3D({ cut: !ui.view3d.cut }));
  shell.xray.addEventListener('click', () => app.setView3D({ xray: !ui.view3d.xray }));
  shell.box.addEventListener('click', () => app.toggleBox());
  shell.ortho.addEventListener('click', () => app.setView3D({ ortho: !ui.view3d.ortho }));
  shell.look.style.select.addEventListener('change', () => app.setView3D({ style: shell.look.style.select.value as VisualStyle }));
  shell.look.quality.select.addEventListener('change', () => app.setView3D({ quality: shell.look.quality.select.value as RenderQuality }));
  shell.planScale.select.addEventListener('change', () => app.store.dispatch(setDrawing({ ...drawingOf(app.store.get()), scale: Number(shell.planScale.select.value) })));
  shell.visBtn.addEventListener('click', () => app.actionList().find((a) => a.id === 'view.overrides')?.run());
  shell.shownReset.addEventListener('click', () => app.actionList().find((a) => a.id === 'view.tempReset')?.run());
  shell.light.button.addEventListener('click', () => {
    shell.light.panel.hidden = !shell.light.panel.hidden;
    app.renderChrome();
  });
  shell.light.brightness.input.addEventListener('input', () => app.setView3D({ brightness: Number(shell.light.brightness.input.value) }));
  shell.light.sun.input.addEventListener('input', () => app.setView3D({ sun: Number(shell.light.sun.input.value) }));
  shell.tempReset.addEventListener('click', () => app.resetTemporary());
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.commands.addEventListener('click', () => palette());
}
