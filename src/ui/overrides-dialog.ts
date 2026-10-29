// Graphic overrides (phase 9): walls of a type filled in plan with a colour of their own (walls to
// demolish in red, new ones in green), rooms of a use too, shown or not as the view says. A row a type
// or a use: it, its colour, its remove button; one command each change (app/layer-sets.ts).

import type { App } from '../app/app';
import { type RoomOverride, setOverrides, setRoomOverrides, type WallOverride } from '../app/layer-sets';
import { ROOM_USES } from '../elements/room/schema';
import { newId } from '../core/id';
import { el, select } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, name, t } from './i18n';
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
    // The first type without one, in blue: red and yellow are the phases' (to build, to demolish), drawn over
    // these. None when every type has one: a second for a type left its colour to the list's order.
    const free = doc.wallTypes.find((w) => !list.some((o) => o.wallTypeId === w.id));
    add.toggleAttribute('disabled', !free);
    add.addEventListener('click', () => free && set([...list, { id: newId('override'), wallTypeId: free.id, color: '#4a7fd6' }]));
    // Rooms of a use: a row a use, its colour, its remove button.
    const rooms = doc.roomOverrides ?? [];
    const setRooms = (next: readonly RoomOverride[]) => app.store.dispatch(setRoomOverrides(next));
    const roomRows = rooms.map((o, i) => {
      const use = select(
        ROOM_USES.map((u) => ({ value: u, label: t(`use.${u}` as MessageKey) })),
        o.use,
        (v) => setRooms(rooms.map((x, k) => (k === i ? { ...x, use: v } : x))),
      );
      const sel = use.querySelector('select')!;
      sel.setAttribute('aria-label', t('ovr.useN', { n: i + 1 }));
      sel.dataset.focus = `use:${o.id}`;
      const colour = el('input', { type: 'color', class: 'mat-color', 'aria-label': t('ovr.roomColourN', { n: i + 1 }) });
      colour.value = o.color;
      colour.dataset.focus = `rcolour:${o.id}`;
      colour.addEventListener('change', () => setRooms(rooms.map((x, k) => (k === i ? { ...x, color: colour.value } : x))));
      const del = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('ovr.roomRemoveN', { n: i + 1 }), title: t('ovr.roomRemoveN', { n: i + 1 }) });
      del.innerHTML = icon('trash', 16);
      del.dataset.focus = `rdel:${o.id}`;
      del.addEventListener('click', () => setRooms(rooms.filter((_, k) => k !== i)));
      return el('div', { class: 'vars-row' }, use, colour, del);
    });
    const addRoom = el('button', { type: 'button', class: 'icon-btn text-btn vars-add' });
    addRoom.innerHTML = icon('plus', 16);
    addRoom.append(t('ovr.addRoom'));
    addRoom.dataset.focus = 'addRoom';
    // The first use without one, in blue (the wet areas are the usual first).
    const freeUse = ROOM_USES.find((u) => !rooms.some((o) => o.use === u) && u === 'bathroom') ?? ROOM_USES.find((u) => !rooms.some((o) => o.use === u));
    addRoom.toggleAttribute('disabled', !freeUse);
    addRoom.addEventListener('click', () => freeUse && setRooms([...rooms, { id: newId('override'), use: freeUse, color: '#3b82f6' }]));
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
      el(
        'div',
        { class: 'units-body' },
        el('h3', {}, t('ovr.walls')),
        ...(rows.length ? rows : [el('p', { class: 'mat-note' }, t('ovr.empty'))]),
        add,
        el('p', { class: 'mat-note' }, t('ovr.note')),
        el('h3', {}, t('ovr.rooms')),
        ...(roomRows.length ? roomRows : [el('p', { class: 'mat-note' }, t('ovr.roomsEmpty'))]),
        addRoom,
        el('p', { class: 'mat-note' }, t('ovr.roomsNote')),
        // The walls' phases in a renovation (the wall panel's "Phase"), drawn while the overrides are on.
        el('h3', {}, t('ovr.phases')),
        el('p', { class: 'mat-note' }, t(app.store.get().walls.some((w) => w.phase) ? 'ovr.phasesOn' : 'ovr.phasesNone')),
      ),
      el('div', { class: 'actions' }, on, el('span', { class: 'spacer' }), done),
    );
  });
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="add"]')?.focus();
}
