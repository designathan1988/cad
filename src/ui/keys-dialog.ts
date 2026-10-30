// Customising the shortcuts (phase 9; WCAG 2.1.4): every action of the palette with its key now; a
// new one by pressing it, none (off), or its own back. A key given to one action is taken from any
// other that had it, and said. Kept with the preferences, not in the project (app/keymap.ts).

import type { App } from '../app/app';
import { assignKey, comboOf, keyOf } from '../app/keymap';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { t } from '../i18n/messages';

export function showKeys(app: App): void {
  let filter = '';
  let capturing: string | null = null;
  let said = '';
  // A key pressed while capturing is the new key (Esc gives up); taken before the app's own keys.
  const listen = (e: KeyboardEvent) => {
    if (capturing === null) return;
    const combo = comboOf(e);
    if (combo === null) return;
    e.preventDefault();
    e.stopPropagation();
    const id = capturing;
    capturing = null;
    window.removeEventListener('keydown', listen, true);
    if (combo === 'Esc') {
      said = '';
      return dialog.redraw();
    }
    const acts = app.actionList();
    const { map, taken } = assignKey(app.keymap, acts, id, combo);
    app.setKeymap(map);
    const label = acts.find((a) => a.id === id)?.label ?? id;
    said = taken.length ? t('keys.taken', { key: combo, action: label, from: taken.map((a) => a.label).join(', ') }) : t('keys.set', { key: combo, action: label });
    dialog.redraw();
  };
  const dialog = openProjectDialog(app, (close) => {
    const acts = app.actionList().filter((a) => !/^(level|tool\.object|snap\.parts)\./.test(a.id));
    const search = el('input', { type: 'search', class: 'keys-search', placeholder: t('keys.search'), 'aria-label': t('keys.search') });
    search.value = filter;
    search.dataset.focus = 'search';
    search.addEventListener('input', () => {
      filter = search.value;
      dialog.redraw();
    });
    const shown = acts.filter((a) => `${a.label} ${a.keywords} ${a.keys ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase()));
    const list = el('div', { class: 'keys-list', role: 'list', 'aria-label': t('keys.title') });
    for (const a of shown) {
      const own = a.defaultKeys;
      const now = keyOf(a.id, own, app.keymap);
      const changed = a.id in app.keymap;
      const key = el('button', { type: 'button', class: 'kbd keys-key', 'aria-label': t('keys.change', { action: a.label, key: now ?? t('keys.none') }) }, capturing === a.id ? t('keys.press') : (now ?? '—'));
      key.dataset.focus = `key:${a.id}`;
      if (capturing === a.id) key.setAttribute('aria-pressed', 'true');
      key.addEventListener('click', () => {
        capturing = a.id;
        said = t('keys.pressFor', { action: a.label });
        window.addEventListener('keydown', listen, true);
        dialog.redraw();
      });
      const off = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('keys.off'));
      off.dataset.focus = `off:${a.id}`;
      off.toggleAttribute('disabled', now === undefined);
      off.addEventListener('click', () => {
        app.setKeymap({ ...app.keymap, [a.id]: null });
        said = t('keys.turnedOff', { action: a.label });
        dialog.redraw();
      });
      const back = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('keys.default'));
      back.dataset.focus = `default:${a.id}`;
      back.toggleAttribute('disabled', !changed);
      back.addEventListener('click', () => {
        const { [a.id]: _gone, ...rest } = app.keymap;
        app.setKeymap(rest);
        said = t('keys.back', { action: a.label, key: own ?? t('keys.none') });
        dialog.redraw();
      });
      list.append(el('div', { class: changed ? 'keys-row keys-changed' : 'keys-row', role: 'listitem' }, el('span', { class: 'keys-name' }, a.label, el('span', { class: 'keys-group' }, a.group)), key, off, back));
    }
    const reset = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('keys.resetAll'));
    reset.dataset.focus = 'resetAll';
    reset.toggleAttribute('disabled', Object.keys(app.keymap).length === 0);
    reset.addEventListener('click', () => {
      app.setKeymap({});
      said = t('keys.allBack');
      dialog.redraw();
    });
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', () => {
      capturing = null;
      window.removeEventListener('keydown', listen, true);
      close();
    });
    return el(
      'div',
      { class: 'dialog dialog-wide keys-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('keys.title') },
      el('h2', {}, t('keys.title')),
      el('div', { class: 'keys-top' }, search, el('p', { class: 'mat-note', role: 'status' }, said || t('keys.note'))),
      list,
      el('div', { class: 'actions' }, reset, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="search"]')?.focus();
}
