// The interface's buttons (input.ts): the title bar, the view's header, its controls and the status bar's.
// Each sends what it says to the app. The bars of actions (ui/bars.ts) run their actions themselves.

import { t } from '../i18n/messages';
import type { App } from './app';
import { openProjectMenu } from '../ui/project-menu';
import { openLevelMenu } from '../ui/view-header';
import type { LevelsShown, RenderQuality, VisualStyle } from './view/view-3d';
import { renameInPlace } from '../ui/rename-in-place';
import { setView, setView3D, toggleBox, toggleExplode } from './view-ui';
import { resetTemporary } from './selection';
import * as appSettings from './app-settings';
import * as appEdit from './app-edit';
import * as appView from './app-view';

export function wireButtons(app: App, palette: () => void): void {
  const { shell, ui } = app;
  shell.undo.addEventListener('click', () => appEdit.undo(app));
  shell.redo.addEventListener('click', () => appEdit.redo(app));
  shell.projectMenu.addEventListener('click', () => openProjectMenu(app));
  shell.view3d.addEventListener('click', () => setView(app, '3d'));
  shell.viewPlan.addEventListener('click', () => setView(app, 'plan'));
  shell.level.addEventListener('click', () => openLevelMenu(app));
  shell.frameAll.addEventListener('click', () => app.frameAll());
  shell.sectionOff.addEventListener('click', () => app.actionList().find((a) => a.id === 'view.sectionOff')?.run());
  shell.projectName.addEventListener('click', () => renameInPlace(app));
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void appView.openFile(app, file);
  });
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
  shell.planScale.select.addEventListener('change', () => appView.chooseScale(app, Number(shell.planScale.select.value)));
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
  shell.commands.addEventListener('click', () => palette());
}
