// The interface's buttons (input.ts): the top bar, the tool bar, the 3D bar, the tour and point cards,
// the file, language and theme buttons. Each sends what it says to the app.

import { t } from '../ui/i18n';
import type { App } from './app';
import { EDIT_LEVELS } from './app';
import { showLevels } from '../ui/levels-dialog';
import { showMenu } from '../ui/menu';
import type { LevelsShown } from './view-3d';
import type { ModifyKind } from '../tools/modify-tool';
import { renameInPlace, showHelp } from './input';

export function wireButtons(app: App, palette: () => void): void {
  const { shell, ui } = app;
  shell.undo.addEventListener('click', () => app.undo());
  shell.redo.addEventListener('click', () => app.redo());
  shell.homeBtn.addEventListener('click', () => app.frameAll());
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
  shell.newFile.addEventListener('click', () => app.newProject());
  shell.projectName.addEventListener('click', () => renameInPlace(app));
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void app.openFile(file);
  });
  shell.panelToggle.addEventListener('click', () => app.togglePanel());
  shell.toolSelect.addEventListener('click', () => app.setTool('select'));
  shell.toolWall.addEventListener('click', () => app.setTool('wall'));
  shell.toolDoor.addEventListener('click', () => app.setTool('door'));
  shell.toolWindow.addEventListener('click', () => app.setTool('window'));
  shell.toolRoom.addEventListener('click', () => app.setTool('room'));
  shell.toolFloor.addEventListener('click', () => app.setTool('floor'));
  shell.toolMeasure.addEventListener('click', () => app.setTool('measure'));
  shell.toolDimension.addEventListener('click', () => app.setTool('dimension'));
  shell.toolGrid.addEventListener('click', () => app.setTool('grid'));
  shell.toolColumn.addEventListener('click', () => app.setTool('column'));
  shell.toolBeam.addEventListener('click', () => app.setTool('beam'));
  shell.toolRoof.addEventListener('click', () => app.setTool('roof'));
  shell.toolStair.addEventListener('click', () => app.setTool('stair'));
  shell.toolRailing.addEventListener('click', () => app.setTool('railing'));
  shell.toolSplit.addEventListener('click', () => app.setTool('split'));
  shell.toolCorner.addEventListener('click', () => app.setTool('corner'));
  for (const [kind, b] of Object.entries(shell.modifyTools)) b.addEventListener('click', () => app.startModify(kind as ModifyKind));
  // The edit tools the top bar had no room for, under its More button.
  shell.moreTools.addEventListener('click', () => {
    const r = shell.moreTools.getBoundingClientRect();
    showMenu(shell.foldedTools(), { x: r.left, y: r.bottom + 4 }, t('top.moreTools'));
  });
  // The right side's buttons it had no room for (language, theme, files), under its menu.
  shell.moreApp.addEventListener('click', () => {
    const r = shell.moreApp.getBoundingClientRect();
    showMenu(shell.foldedApp(), { x: r.right, y: r.bottom + 4 }, t('top.moreOptions'));
  });
  shell.snapBtn.addEventListener('click', () => app.toggleSnaps());
  for (const [mode, b] of Object.entries(shell.levelsShown)) b.addEventListener('click', () => app.setView3D({ levels: mode as LevelsShown }));
  shell.explode.addEventListener('click', () => app.toggleExplode());
  shell.cut.addEventListener('click', () => app.setView3D({ cut: !ui.view3d.cut }));
  shell.xray.addEventListener('click', () => app.setView3D({ xray: !ui.view3d.xray }));
  shell.box.addEventListener('click', () => app.toggleBox());
  shell.ortho.addEventListener('click', () => app.setView3D({ ortho: !ui.view3d.ortho }));
  shell.tempReset.addEventListener('click', () => app.resetTemporary());
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.commands.addEventListener('click', () => palette());
}
