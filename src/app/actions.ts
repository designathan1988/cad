// Everything the user can do by name: tools, views, editing, files, settings, levels, help. The
// command palette lists these; the toolbar, keys and menus do the same things, with the same names
// and keys (ref/chat.txt:200), because they read them from here.

import { tBoth, name, t, type MessageKey } from '../ui/i18n';
import type { App } from './app';

export interface Action {
  readonly id: string;
  readonly label: string;
  /** Where it lives, shown beside it: tools, views, edit, file, settings, levels, help. */
  readonly group: string;
  /** Words that also find it: its name in the other language. */
  readonly keywords: string;
  readonly keys?: string;
  readonly enabled: boolean;
  readonly run: () => void;
}

/** What only the input layer can open (dialogs, the file picker, the tour). */
export interface Openers {
  readonly help: () => void;
  readonly levels: () => void;
  readonly tour: () => void;
  readonly openFile: () => void;
}

export function appActions(app: App, open: Openers): Action[] {
  const { ui, store } = app;
  const doc = store.get();
  const has = ui.selection.size > 0;
  const make = (id: string, key: MessageKey, group: MessageKey, run: () => void, extra: { keys?: string; enabled?: boolean } = {}): Action => ({
    id,
    label: t(key),
    group: t(group),
    keywords: tBoth(key),
    enabled: extra.enabled ?? true,
    run,
    ...(extra.keys ? { keys: extra.keys } : {}),
  });
  const tools = 'pal.group.tools';
  const views = 'pal.group.views';
  const edit = 'pal.group.edit';
  const file = 'pal.group.file';
  const settings = 'pal.group.settings';
  const levels = 'pal.group.levels';
  const help = 'pal.group.help';
  return [
    make('tool.select', 'tool.select', tools, () => app.setTool('select'), { keys: 'V' }),
    make('tool.wall', 'tool.wall', tools, () => app.setTool('wall'), { keys: 'W' }),
    make('tool.arcWall', 'pal.arcWall', tools, () => {
      app.setTool('wall');
      app.wallEvent({ kind: 'arc' });
    }, { keys: 'W, A' }),
    make('tool.floor', 'tool.floor', tools, () => app.setTool('floor'), { keys: 'L' }),
    make('tool.door', 'tool.door', tools, () => app.setTool('door'), { keys: 'D' }),
    make('tool.window', 'tool.window', tools, () => app.setTool('window'), { keys: 'Shift+W' }),
    make('tool.room', 'tool.room', tools, () => app.setTool('room'), { keys: 'R' }),
    make('view.3d', 'view.3d', views, () => app.setView('3d'), { keys: '1', enabled: ui.view !== '3d' }),
    make('view.plan', 'view.plan', views, () => app.setView('plan'), { keys: '2', enabled: ui.view !== 'plan' }),
    make('view.frameSelection', 'pal.frameSelection', views, () => app.frameSelection(), { keys: 'F', enabled: has }),
    make('view.frameAll', 'pal.frameAll', views, () => app.frameAll(), { keys: 'Home' }),
    make('edit.undo', 'pal.undo', edit, () => app.undo(), { keys: 'Ctrl+Z', enabled: store.canUndo() }),
    make('edit.redo', 'pal.redo', edit, () => app.redo(), { keys: 'Ctrl+Shift+Z', enabled: store.canRedo() }),
    make('edit.delete', 'pal.delete', edit, () => app.deleteSelection(), { keys: 'Del', enabled: has }),
    make('edit.selectAll', 'pal.selectAll', edit, () => app.selectAllWalls(), { keys: 'Ctrl+A' }),
    make('edit.clearSelection', 'pal.clearSelection', edit, () => app.clearSelection(), { keys: 'Esc', enabled: has }),
    make('file.open', 'pal.open', file, open.openFile, { keys: 'Ctrl+O' }),
    make('file.save', 'pal.save', file, () => app.saveFile(), { keys: 'Ctrl+S' }),
    make('settings.snaps', 'pal.snaps', settings, () => app.toggleSnaps(), { keys: 'S' }),
    make('settings.theme', 'pal.theme', settings, () => app.toggleTheme()),
    make('settings.language', 'pal.language', settings, () => app.setLanguage(app.otherLanguage()), { keys: 'Shift+L' }),
    make('settings.panel', 'pal.panel', settings, () => app.togglePanel()),
    make('settings.browser', 'pal.browser', settings, () => app.toggleBrowser()),
    ...(['walls', 'openings', 'rooms', 'floors'] as const).map((c) =>
      make(`layer.${c}`, ui.hidden.has(c) ? (`pal.show.${c}` as const) : (`pal.hide.${c}` as const), settings, () => app.toggleCategory(c)),
    ),
    ...[...doc.levels]
      .sort((a, b) => b.elevation - a.elevation)
      .map((l) => ({
        id: `level.${l.id}`,
        label: t('pal.goLevel', { name: name(l.name) }),
        group: t(levels),
        // Either language's command, with the stored name and the shown one.
        keywords: `${tBoth('pal.goLevel', { name: l.name })} ${name(l.name)}`,
        enabled: l.id !== ui.levelId,
        run: () => app.setLevel(l.id),
      })),
    make('level.edit', 'levels.edit', levels, open.levels),
    make('help.shortcuts', 'pal.shortcuts', help, open.help, { keys: '?' }),
    make('help.tour', 'pal.tour', help, open.tour),
  ];
}
