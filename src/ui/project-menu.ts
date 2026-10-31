// The title bar's Project menu: what is the project's and has no other place, in groups: its files, what is
// imported into it, its settings, its elevations, and the interface (language, theme, the keys' help).

import type { App } from '../session/app';
import { type MessageKey, t } from '../i18n/messages';
import type { IconName } from '../i18n/icons';
import { type MenuItem, showMenu } from './menu';

const PROJECT_MENU: readonly { readonly group: MessageKey; readonly items: readonly (readonly [string, IconName])[] }[] = [
  { group: 'menu.g.file', items: [['file.new', 'fileNew'], ['file.projects', 'folder'], ['file.open', 'fileOpen'], ['file.save', 'download']] },
  { group: 'menu.g.import', items: [['ref.import', 'map'], ['model.import', 'box']] },
  { group: 'menu.g.settings', items: [['units.edit', 'ruler'], ['settings.variables', 'hash'], ['drawing.edit', 'scale'], ['settings.keys', 'keyboard']] },
  { group: 'menu.g.elevations', items: [['view.elevation.north', 'arrowUp'], ['view.elevation.south', 'arrowDown'], ['view.elevation.east', 'chevronRight'], ['view.elevation.west', 'chevronLeft']] },
  { group: 'menu.g.interface', items: [['settings.language', 'language'], ['settings.theme', 'moon'], ['help.shortcuts', 'keyboard']] },
];

/** Opens the menu under its button, which says it is open until it closes. */
export function openProjectMenu(app: App): void {
  const button = app.shell.projectMenu;
  const actions = new Map(app.actionList().map((a) => [a.id, a]));
  const items: MenuItem[] = PROJECT_MENU.flatMap(({ group, items }) =>
    items.flatMap(([id, ic], i) => {
      const a = actions.get(id);
      return a ? [{ label: a.label, icon: ic, ...(a.keys ? { keys: a.keys } : {}), disabled: !a.enabled, ...(i === 0 ? { group: t(group) } : {}), run: a.run }] : [];
    }),
  );
  const r = button.getBoundingClientRect();
  button.setAttribute('aria-expanded', 'true');
  showMenu(items, { x: r.left, y: r.bottom + 2 }, t('top.project'), 0, () => button.setAttribute('aria-expanded', 'false'));
}
