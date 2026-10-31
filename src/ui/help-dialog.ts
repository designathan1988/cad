// The keyboard shortcuts dialog (?): the keys of every action, grouped as the palette groups them.

import type { App } from '../session/app';
import { t } from '../i18n/messages';
import { el } from './controls';
import { showKeys } from './keys-dialog';
import { SECOND_KEYS } from '../session/keymap';

export function showHelp(app: App): void {
  const back = app.shell.helpBack;
  // An action's row is its id: its name and its key as the user has it now (or none) come from the
  // action list, as the palette, buttons and menus have them. The rest are the tools' own keys and gestures.
  const acts = new Map(app.actionList().map((a) => [a.id, a] as const));
  const action = (id: string): [string, string] => {
    const a = acts.get(id);
    const second = a?.keys !== undefined && a.keys === a.defaultKeys ? SECOND_KEYS[id] : undefined;
    return [a?.keys ? (second ? `${a.keys} / ${second}` : a.keys) : '—', a?.label ?? id];
  };
  const rows: [string, string][] = [
    ...['tool.select', 'tool.wall', 'tool.arcWall', 'tool.rectWall', 'tool.door', 'tool.window', 'tool.room', 'tool.floor', 'tool.measure'].map(action),
    ...['edit.move', 'edit.copy', 'edit.rotate', 'edit.scale', 'edit.mirror', 'edit.split', 'edit.corner', 'edit.merge', 'view.tempHide', 'view.tempIsolate'].map(action),
    [t('help.guideKey'), t('help.guide')],
    action('view.3d'),
    action('view.plan'),
    ['Enter', t('help.enter')],
    ['Tab', t('help.tab')],
    ['Esc', t('help.esc')],
    ['Backspace', t('help.backspace')],
    [t('key.spaceKey'), t('help.space')],
    [t('help.rightClickKey'), t('help.rightClick')],
    [t('help.dragAloneKey'), t('help.dragAlone')],
    ['U', t('help.disjoin', { key: app.keyName('edit.move') })],
    ...['edit.delete', 'view.frameSelection', 'view.frameAll'].map(action),
    ['+ / −', t('help.zoomKeys')],
    ['Shift+↑↓←→', t('help.panKeys')],
    action('settings.snaps'),
    ['Shift', t('help.shift')],
    ...['edit.selectAll', 'edit.undo', 'edit.redo', 'file.open', 'file.save', 'help.commands', 'settings.language', 'edit.next', 'edit.previous'].map(action),
    [t('help.arrowsKey'), t('help.arrows')],
    action('help.shortcuts'),
    [t('help.clickAgainKey'), t('help.clickAgain')],
    [t('help.wheelKey'), t('help.wheel')],
    [t('help.middleKey'), t('help.middle')],
    [t('help.orbitKey'), t('help.orbit')],
  ];
  const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
  const dl = el('dl');
  for (const [k, v] of rows) dl.append(el('dt', {}, el('span', { class: 'kbd' }, k)), el('dd', {}, v));
  // Shortcuts remapped or turned off there (WCAG 2.1.4).
  const custom = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('keys.open'));
  custom.addEventListener('click', () => showKeys(app));
  const dialog = el('div', { class: 'dialog help-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') }, el('h2', {}, t('help.title')), dl, el('div', { class: 'actions' }, custom, el('span', { class: 'spacer' }), close));
  back.replaceChildren(dialog);
  back.hidden = false;
  const hide = () => {
    back.hidden = true;
    app.shell.planCanvas.focus();
  };
  close.addEventListener('click', hide);
  back.onclick = (e) => {
    if (e.target === back) hide();
  };
  back.onkeydown = (e) => {
    if (e.key === 'Escape') hide();
  };
  // The list takes the focus, so it opens at its top and the arrows and Page Down scroll it (only the
  // list scrolls, help-dialog in styles.css); Tab then reaches Close.
  dl.tabIndex = 0;
  dl.setAttribute('aria-label', t('help.title'));
  dl.scrollTop = 0;
  dl.focus({ preventScroll: true });
}
