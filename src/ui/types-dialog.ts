// The wall types dialog (ref/chat.txt:12, the tester's D5): the list of types, and the one chosen with
// its name, top, base and layers. New, duplicate and delete. Every change is one command, and every
// wall of the type follows at once, being derived from it.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { wallTypeFields } from '../elements/wall/type-fields';
import { addWallType, deleteWallType, duplicateWallType, typeDeleteBlocker, updateWallType } from '../elements/wall/types';
import type { WallTypeId } from '../elements/wall/schema';
import { el } from './controls';
import { fieldsSection } from './fields';
import { defaultName, name, t } from './i18n';
import { icon } from './icons';
import { layerEditor } from './layer-editor';
import { layerSwatch } from './swatch';

export function showWallTypes(app: App, first?: WallTypeId): void {
  const back = app.shell.helpBack;
  let chosen = first ?? app.store.get().wallTypes[0]!.id;

  const render = () => {
    const doc = app.store.get();
    if (!doc.wallTypes.some((x) => x.id === chosen)) chosen = doc.wallTypes[0]!.id;
    const type = doc.wallTypes.find((x) => x.id === chosen)!;
    const used = (id: WallTypeId) => doc.walls.filter((w) => w.wallTypeId === id).length;

    const list = el('div', { class: 'types-list', role: 'group', 'aria-label': t('types.list') });
    for (const x of doc.wallTypes) {
      const b = el('button', { type: 'button', class: 'types-item', 'aria-pressed': String(x.id === chosen) });
      b.dataset.focus = `type:${x.id}`;
      b.insertAdjacentHTML('beforeend', layerSwatch(x.layers));
      b.append(el('span', { class: 'types-name' }, name(x.name)), el('span', { class: 'types-count' }, t('types.usedBy', { n: used(x.id) })));
      b.addEventListener('click', () => {
        chosen = x.id;
        render();
        back.querySelector<HTMLElement>(`[data-focus="type:${x.id}"]`)?.focus();
      });
      list.append(b);
    }

    const update = (patch: Parameters<typeof updateWallType>[1]) => app.store.dispatch(updateWallType(type.id, patch));
    const general = fieldsSection(t('types.general'), true, wallTypeFields({ update }), [type]);
    const layers = layerEditor(type.layers, (next) => update({ layers: next }));

    const btn = (label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    const add = btn(t('types.new'), 'new', () => {
      const id = newId('wt');
      // A new type starts as a copy of the chosen one's layers, under a name of its own.
      app.store.dispatch(addWallType({ id, name: defaultName.wallType(doc.wallTypes.length + 1), layers: type.layers }));
      chosen = id;
    });
    const dup = btn(t('types.duplicate'), 'duplicate', () => {
      const id = newId('wt');
      const copies = doc.wallTypes.filter((x) => x.name.startsWith(`${type.name} (`)).length;
      app.store.dispatch(duplicateWallType(type.id, id, defaultName.copy(type.name, copies + 2)));
      chosen = id;
    });
    const del = el('button', { type: 'button', class: 'icon-btn' });
    del.innerHTML = icon('trash', 16);
    del.dataset.focus = 'delete';
    const blocker = typeDeleteBlocker(doc, type.id);
    const action = t('types.deleteNamed', { name: name(type.name) });
    const why = blocker === 'inUse' ? t('types.cantDeleteInUse') : blocker === 'last' ? t('types.cantDeleteLast') : null;
    del.disabled = why !== null;
    del.setAttribute('aria-label', action);
    // What it does, then why it cannot.
    del.title = why ? `${action}: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : action;
    const whyNode = why ? el('span', { id: 'types-why', class: 'sr-only' }, why) : null;
    if (whyNode) del.setAttribute('aria-describedby', 'types-why');
    del.addEventListener('click', () => app.store.dispatch(deleteWallType(type.id)));

    const close = btn(t('help.close'), 'close', hide);
    const dialog = el(
      'div',
      { class: 'dialog dialog-wide types-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('types.title') },
      el('h2', {}, t('types.title')),
      el('div', { class: 'types-body' }, list, el('div', { class: 'types-detail' }, general, layers)),
      el('div', { class: 'actions' }, add, dup, del, ...(whyNode ? [whyNode] : []), el('span', { class: 'spacer' }), close),
    );
    back.replaceChildren(dialog);
  };

  const unsubscribe = app.store.subscribe(() => {
    // Rebuild unless a field of the dialog is being typed in; a button keeps the focus across it.
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && back.contains(active)) return;
    const key = active instanceof HTMLElement && back.contains(active) ? active.dataset.focus : undefined;
    render();
    if (key) (back.querySelector<HTMLElement>(`[data-focus="${key}"]`) ?? back.querySelector<HTMLElement>('[data-focus="close"]'))?.focus();
  });
  const hide = () => {
    unsubscribe();
    back.hidden = true;
    back.onkeydown = null;
    app.shell.planCanvas.focus();
  };
  back.onclick = (e) => {
    if (e.target === back) hide();
  };
  back.onkeydown = (e) => {
    if (e.key === 'Escape') hide();
  };
  render();
  back.hidden = false;
  // Focus on the chosen type in the list: Tab goes on to its fields, Esc closes.
  back.querySelector<HTMLElement>(`[data-focus="type:${chosen}"]`)?.focus();
}
