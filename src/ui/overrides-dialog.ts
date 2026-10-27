// Graphic overrides (phase 9): walls of a type filled in plan with a colour of their own (walls to
// demolish in red, new ones in green), shown or not as the view says. A row a type: its type, its
// colour, its remove button; one command each change (app/layer-sets.ts).

import type { App } from '../app/app';
import { setOverrides, type WallOverride } from '../app/layer-sets';
import { newId } from '../core/id';
import { el, select } from './controls';
import { openProjectDialog } from './dialog';
import { name, t } from './i18n';
import { icon } from './icons';

export function showOverrides(app: App): void {
  openProjectDialog(app, (close) => {
    const doc = app.store.get();
    const list = doc.overrides ?? [];
    const set = (next: readonly WallOverride[]) => app.store.dispatch(setOverrides(next));
    const rows = list.map((o, i) => {
      const type = select(
        doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name) })),
        o.wallTypeId,
        (v) => set(list.map((x, k) => (k === i ? { ...x, wallTypeId: v } : x))),
      );
      const sel = type.querySelector('select')!;
      sel.setAttribute('aria-label', t('ovr.typeN', { n: i + 1 }));
      sel.dataset.focus = `type:${o.id}`;
      const colour = el('input', { type: 'color', class: 'mat-color', 'aria-label': t('ovr.colourN', { n: i + 1 }) });
      colour.value = o.color;
      colour.dataset.focus = `colour:${o.id}`;
      colour.addEventListener('change', () => set(list.map((x, k) => (k === i ? { ...x, color: colour.value } : x))));
      const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('ovr.removeN', { n: i + 1 }), title: t('ovr.removeN', { n: i + 1 }) });
      del.innerHTML = icon('trash', 16);
      del.dataset.focus = `del:${o.id}`;
      del.addEventListener('click', () => set(list.filter((_, k) => k !== i)));
      return el('div', { class: 'vars-row' }, type, colour, del);
    });
    const add = el('button', { type: 'button', class: 'icon-btn text-btn vars-add' });
    add.innerHTML = icon('plus', 16);
    add.append(t('ovr.add'));
    add.dataset.focus = 'add';
    // The first type without one, in red (a wall to demolish is the usual first).
    const free = doc.wallTypes.find((w) => !list.some((o) => o.wallTypeId === w.id)) ?? doc.wallTypes[0];
    add.toggleAttribute('disabled', !free);
    add.addEventListener('click', () => free && set([...list, { id: newId('override'), wallTypeId: free.id, color: '#d64545' }]));
    const on = el('button', { type: 'button', class: 'icon-btn text-btn', 'aria-pressed': String(app.ui.overridesOn) }, t(app.ui.overridesOn ? 'ovr.shown' : 'ovr.hiddenNow'));
    on.dataset.focus = 'on';
    on.addEventListener('click', () => {
      app.toggleOverrides();
      close();
      showOverrides(app);
    });
    const done = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    done.dataset.focus = 'close';
    done.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ovr.title') },
      el('h2', {}, t('ovr.title')),
      el('div', { class: 'units-body' }, ...(rows.length ? rows : [el('p', { class: 'mat-note' }, t('ovr.empty'))]), add, el('p', { class: 'mat-note' }, t('ovr.note'))),
      el('div', { class: 'actions' }, on, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="add"]')?.focus();
}
