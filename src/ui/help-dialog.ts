// The keyboard shortcuts dialog (?): the keys of every action, grouped as the palette groups them.

import type { App } from '../session/app';
import { t } from '../i18n/messages';
import { el } from './controls';
import { showKeys } from './keys-dialog';

export function showHelp(app: App): void {
  const back = app.shell.helpBack;
  // The same names as the palette, buttons and menus (ref/chat.txt:200): read from the same messages.
  const rows: [string, string][] = [
    ['V', t('tool.select')],
    ['W', t('tool.wall')],
    ['W, A', t('pal.arcWall')],
    ['W, Q', t('pal.rectWall')],
    ['D', t('tool.door')],
    ['Shift+W', t('tool.window')],
    ['R', t('tool.room')],
    ['L', t('tool.floor')],
    ['M', t('tool.measure')],
    ['Shift+M', t('pal.move')],
    ['Shift+C', t('pal.copy')],
    ['Shift+R', t('pal.rotate')],
    ['Shift+E', t('pal.scale')],
    ['Shift+X', t('pal.mirror')],
    ['Shift+S', t('pal.split')],
    ['Shift+T', t('pal.corner')],
    ['Shift+J', t('pal.merge')],
    ['Shift+H', t('pal.tempHide')],
    ['Shift+I', t('pal.tempIsolate')],
    [t('help.guideKey'), t('help.guide')],
    ['1 / 2', `${t('view.3d')} / ${t('view.plan')}`],
    ['Enter', t('help.enter')],
    ['Tab', t('help.tab')],
    ['Esc', t('help.esc')],
    ['Backspace', t('help.backspace')],
    [t('key.spaceKey'), t('help.space')],
    [t('help.rightClickKey'), t('help.rightClick')],
    [t('help.dragAloneKey'), t('help.dragAlone')],
    ['U', t('help.disjoin')],
    ['Del', t('pal.delete')],
    ['F', t('pal.frameSelection')],
    ['Home', t('pal.frameAll')],
    ['+ / −', t('help.zoomKeys')],
    ['Shift+↑↓←→', t('help.panKeys')],
    ['S', t('pal.snaps')],
    ['Shift', t('help.shift')],
    ['Ctrl+A', t('pal.selectAll')],
    ['Ctrl+Z', t('pal.undo')],
    ['Ctrl+Shift+Z / Ctrl+Y', t('pal.redo')],
    ['Ctrl+O', t('pal.open')],
    ['Ctrl+S', t('pal.save')],
    ['Ctrl+K', t('pal.commands')],
    ['Shift+L', t('pal.language')],
    ['N', t('pal.stepSelection')],
    ['Shift+N', t('pal.stepBack')],
    [t('help.arrowsKey'), t('help.arrows')],
    ['?', t('pal.shortcuts')],
    [t('help.clickAgainKey'), t('help.clickAgain')],
    [t('help.wheelKey'), t('help.wheel')],
    [t('help.middleKey'), t('help.middle')],
    [t('help.orbitKey'), t('help.orbit')],
  ];
  const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
  // The keys as they are now: an action's own key, or the one the user gave it, or none (keymap.ts).
  const acts = app.actionList();
  const now = (k: string, v: string) => {
    const a = acts.find((x) => x.defaultKeys === k && x.label === v);
    return a ? (a.keys ?? '—') : k;
  };
  const dl = el('dl');
  for (const [k, v] of rows) dl.append(el('dt', {}, el('span', { class: 'kbd' }, now(k, v))), el('dd', {}, v));
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
