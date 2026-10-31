// The view's header over the drawing's top left: Plan or 3D, the level shown with its elevation (a menu of
// the levels and their editor), and the plan's scale or the 3D view's style. And the right edge's icon bar,
// which opens one panel at a time: the properties, the project's navigator, the library, the materials.

import type { Action } from '../session/actions';
import type { App } from '../session/app';
import { getLang, type MessageKey, name, t } from '../i18n/messages';
import { lengthNum } from '../i18n/units';
import { drawingNow } from '../session/app-view';
import { showMenu } from './menu';
import { setLevel } from '../session/app-edit';
import { type BarEntry, barButtons, barKey, drawBar } from './bars';

/** The level's elevation as the header writes it: "±0,00", "+3,00". */
function elevationText(z: number): string {
  return Math.abs(z) < 0.0005 ? `±${lengthNum(0)}` : `${z > 0 ? '+' : ''}${lengthNum(z)}`;
}

export function renderViewHeader(app: App): void {
  const { shell, ui } = app;
  const doc = app.store.get();
  shell.view3d.setAttribute('aria-pressed', String(ui.view === '3d'));
  shell.viewPlan.setAttribute('aria-pressed', String(ui.view === 'plan'));
  const level = doc.levels.find((l) => l.id === ui.levelId);
  const levelName = level ? name(level.name) : '';
  if (shell.levelName.textContent !== levelName) shell.levelName.textContent = levelName;
  const elevation = level ? elevationText(level.elevation) : '';
  if (shell.levelElevation.textContent !== elevation) shell.levelElevation.textContent = elevation;
  const note = ui.view === 'plan' ? `1:${drawingNow(app).scale}` : t(`view3d.style.${ui.view3d.style}` as MessageKey);
  if (shell.viewNote.textContent !== note) shell.viewNote.textContent = note;
}

/** The levels, highest first, the one shown marked; then their editor. */
export function openLevelMenu(app: App): void {
  const button = app.shell.level;
  const doc = app.store.get();
  const levels = [...doc.levels].sort((a, b) => b.elevation - a.elevation);
  const edit = app.actionList().find((a) => a.id === 'level.edit');
  const r = button.getBoundingClientRect();
  button.setAttribute('aria-expanded', 'true');
  showMenu(
    [
      ...levels.map((l) => ({ label: name(l.name), icon: l.id === app.ui.levelId ? ('check' as const) : ('slab' as const), keys: elevationText(l.elevation), current: l.id === app.ui.levelId, run: () => setLevel(app, l.id) })),
      ...(edit ? [{ label: edit.label, icon: 'levelsAll' as const, separated: true, run: edit.run }] : []),
    ],
    { x: r.left, y: r.bottom + 4 },
    t('top.level'),
    Math.max(0, levels.findIndex((l) => l.id === app.ui.levelId)),
    () => button.setAttribute('aria-expanded', 'false'),
  );
}

export function renderSideBar(app: App, actions: ReadonlyMap<string, Action>): void {
  const { shell, ui } = app;
  const items: readonly BarEntry[] = [
    { id: 'settings.panel', icon: 'tune', pressed: () => !shell.panel.hidden },
    { id: 'settings.browser', icon: 'tree', pressed: () => ui.browserOpen },
    { id: 'library.open', icon: 'library' },
    { id: 'material.edit', icon: 'palette' },
  ];
  drawBar(shell.sideBar, `${getLang()}|${barKey(items, actions)}`, () => barButtons(items, actions, 'vt'));
}
