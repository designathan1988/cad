// The wall types (ref/chat.txt:12, the tester's D5), laid out as the objects' store (objects-dialog.ts):
// the types as cards with a sample of the wall in 3D, its layers stepped at its end; every type or those
// in the project down the side; the chosen one beside them with its picture, its thickness, drawing a
// wall of it as the main action, and its name, top, base and layers to edit. New, duplicate and delete.
// Every change is one command, and every wall of the type follows at once, being derived from it.

import type { App } from '../app/app';
import { fold } from './search';
import { pictureQueue } from './store-pictures';
import { newId } from '../core/id';
import type { Material } from '../elements/material/schema';
import { wallTypeFields } from '../elements/wall/type-fields';
import { addWallType, deleteWallType, duplicateWallType, typeDeleteBlocker, updateWallType } from '../elements/wall/types';
import type { WallLayer, WallTypeId } from '../elements/wall/schema';
import { blockedBy, el } from './controls';
import { openProjectDialog } from './dialog';
import { fieldsSection } from './fields';
import { defaultName, name, nextCopy, t } from './i18n';
import { icon } from './icons';
import { layerEditor } from './layer-editor';
import { lengthText } from './units';
import { wallSnapshot } from './wall-snapshot';

/** Pictures by layers and materials: a type's picture is made again only when they change. */
const pictures = new WeakMap<readonly Material[], WeakMap<readonly WallLayer[], Map<string, string | null>>>();
function pictureOf(layers: readonly WallLayer[], materials: readonly Material[], make: boolean, w = 360, h = 270): string | null | undefined {
  let byLayers = pictures.get(materials);
  if (!byLayers) pictures.set(materials, (byLayers = new WeakMap()));
  let bySize = byLayers.get(layers);
  if (!bySize) byLayers.set(layers, (bySize = new Map()));
  const key = `${w}x${h}`;
  if (!bySize.has(key) && make) bySize.set(key, wallSnapshot(layers, materials, w, h));
  return bySize.get(key);
}

const ALL = 'all';
const USED = 'used';

export function showWallTypes(app: App, first?: WallTypeId): void {
  let chosen = first ?? app.store.get().wallTypes[0]!.id;
  let query = '';
  let folder = ALL;
  let scrolled: number | null = null;
  // The side's scroll, kept as a layer is edited (each change draws the dialog again).
  let sideScrolled = 0;
  const queue = pictureQueue<{ id: string; layers: readonly WallLayer[] }>(() => app.shell.helpBack, (x) => x.id, (x) => pictureOf(x.layers, app.store.get().materials, true));

  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const used = (id: WallTypeId) => doc.walls.filter((w) => w.wallTypeId === id).length;
    const found = doc.wallTypes.filter((x) => query.trim() === '' || fold(name(x.name)).includes(fold(query.trim())));
    const inProject = found.filter((x) => used(x.id) > 0);
    const shown = folder === USED ? inProject : found;
    if (!doc.wallTypes.some((x) => x.id === chosen)) chosen = doc.wallTypes[0]!.id;
    const type = doc.wallTypes.find((x) => x.id === chosen)!;
    const thickness = (layers: readonly WallLayer[]) => layers.reduce((s, l) => s + l.thickness, 0);

    const search = el('input', { type: 'search', class: 'objs-search', placeholder: t('types.search'), 'aria-label': t('types.search') });
    search.value = query;
    search.dataset.focus = 'search';
    search.addEventListener('input', () => {
      query = search.value;
      if (query.trim() !== '') folder = ALL;
      scrolled = 0;
      dialog.redraw();
    });
    const iconBtn = (iconName: Parameters<typeof icon>[0], label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label });
      b.innerHTML = icon(iconName, 18);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    const textBtn = (label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    // The new type is the chosen one before the command runs: the dialog redraws on it at once.
    const add = textBtn(t('types.new'), 'new', () => {
      const id = newId('wt');
      chosen = id;
      // It starts from the chosen one's layers, under a name of its own.
      app.store.dispatch(addWallType({ id, name: defaultName.wallType(doc.wallTypes.length + 1), layers: type.layers }));
    });
    const head = el(
      'div',
      { class: 'objs-head' },
      el('h2', {}, t('types.title')),
      search,
      el('span', { class: 'objs-total' }, t('types.count', { n: found.length })),
      add,
      iconBtn('close', t('help.close'), 'close', close),
    );

    const nav = el('nav', { class: 'objs-nav', 'aria-label': t('types.list') });
    const navItem = (key: string, label: string, n: number) => {
      const b = el('button', { type: 'button', class: 'objs-nav-item', 'aria-pressed': String(folder === key) }, el('span', { class: 'objs-nav-name' }, label), el('span', { class: 'objs-nav-count' }, String(n)));
      b.dataset.focus = `folder:${key}`;
      b.addEventListener('click', () => {
        folder = key;
        scrolled = 0;
        dialog.redraw();
      });
      return b;
    };
    nav.append(navItem(ALL, t('types.all'), found.length), navItem(USED, t('objs.inProject'), inProject.length));

    queue.clear();
    const grid = el('div', { class: 'objs-grid', role: 'group', 'aria-label': t('types.list') });
    grid.addEventListener('scroll', () => (scrolled = grid.scrollTop));
    if (scrolled !== null) {
      const top = scrolled;
      requestAnimationFrame(() => (grid.scrollTop = top));
    }
    for (const x of shown) {
      const card = el('button', { type: 'button', class: 'objs-card', 'aria-pressed': String(x.id === chosen) });
      card.dataset.focus = `type:${x.id}`;
      const src = pictureOf(x.layers, doc.materials, false);
      const img = el('img', { class: `objs-card-img${src ? '' : ' is-loading'}`, alt: '', 'data-picture': x.id });
      if (src) img.src = src;
      else if (src === undefined) queue.add({ id: x.id, layers: x.layers });
      const n = used(x.id);
      card.append(
        el('span', { class: 'objs-card-pic' }, img, ...(n > 0 ? [el('span', { class: 'objs-badge' }, n === 1 ? t('types.usedByOne') : t('types.usedBy', { n }))] : [])),
        el('span', { class: 'objs-card-name' }, name(x.name)),
        el('span', { class: 'objs-card-meta' }, `${lengthText(thickness(x.layers))} · ${x.layers.length === 1 ? t('types.layerOne') : t('types.layerCount', { n: x.layers.length })}`),
      );
      card.addEventListener('click', () => {
        chosen = x.id;
        sideScrolled = 0;
        dialog.redraw();
      });
      grid.append(card);
    }
    if (shown.length === 0) grid.append(el('p', { class: 'objs-empty' }, t('types.noMatch')));

    // The chosen one: its picture, drawing with it, then its fields and layers.
    const update = (patch: Parameters<typeof updateWallType>[1]) => app.store.dispatch(updateWallType(type.id, patch));
    const side = el('aside', { class: 'objs-side' });
    side.addEventListener('scroll', () => (sideScrolled = side.scrollTop));
    {
      const top = sideScrolled;
      requestAnimationFrame(() => (side.scrollTop = top));
    }
    const picture = pictureOf(type.layers, doc.materials, true, 640, 480);
    side.append(picture ? el('img', { class: 'objs-preview', src: picture, alt: name(type.name) }) : el('div', { class: 'objs-preview' }));
    side.append(el('h3', { class: 'objs-name' }, name(type.name)), el('p', { class: 'objs-folder-line' }, `${lengthText(thickness(type.layers))} · ${type.layers.length === 1 ? t('types.layerOne') : t('types.layerCount', { n: type.layers.length })}`));
    const draw = el('button', { type: 'button', class: 'objs-place' }, t('types.draw'));
    draw.dataset.focus = 'draw';
    draw.addEventListener('click', () => {
      close();
      app.ui.defaults = { ...app.ui.defaults, wallTypeId: type.id };
      app.setTool('wall');
    });
    const n = used(type.id);
    side.append(draw, el('p', { class: 'objs-in-project' }, n === 0 ? t('types.unused') : n === 1 ? t('types.usedByOne') : t('types.usedBy', { n })));
    const dup = textBtn(t('types.duplicate'), 'duplicate', () => {
      const id = newId('wt');
      chosen = id;
      const { base, n } = nextCopy(type.name, doc.wallTypes.map((x) => x.name));
      app.store.dispatch(duplicateWallType(type.id, id, defaultName.copy(base, n)));
    });
    const blocker = typeDeleteBlocker(doc, type.id);
    const action = t('types.deleteNamed', { name: name(type.name) });
    const why = blocker === 'inUse' ? t('types.cantDeleteInUse') : blocker === 'last' ? t('types.cantDeleteLast') : null;
    const del = iconBtn('trash', action, 'delete', () => app.store.dispatch(deleteWallType(type.id)));
    const whyNode = blockedBy(del, action, why, 'types-why');
    side.append(
      el('div', { class: 'objs-side-actions' }, dup, el('span', { class: 'spacer' }), del, ...(whyNode ? [whyNode] : [])),
      fieldsSection(t('types.general'), true, wallTypeFields({ update, top: type.top }), [type]),
      layerEditor(type.layers, doc.materials, (next) => update({ layers: next })),
    );
    queue.work();
    return el('div', { class: 'dialog objs-store types-store', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('types.title') }, head, el('div', { class: 'objs-main' }, nav, grid, side));
  };

  // Where the focus goes when its control is gone or disabled (a type deleted): the chosen type.
  const dialog = openProjectDialog(app, render, () => `type:${chosen}`);
  // Focus on the chosen type: Tab goes on, Esc closes.
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="type:${chosen}"]`)?.focus({ preventScroll: true });
}
