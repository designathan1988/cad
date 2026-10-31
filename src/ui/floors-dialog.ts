// The floor build-ups store (room/schema.ts FLOOR_BUILDUPS): each as a card with a sample in 3D, its
// layers stacked in their materials and stepped back at a corner so each shows; the chosen one with its
// layers and thickness, and as its main action drawing a floor of it, or, with floors selected, giving
// them this build-up. Laid out as the objects' store (objects-dialog.ts), with its styles.

import { withLibrary } from './library-tabs';
import * as THREE from 'three';
import type { App } from '../session/app';
import { nextOf } from '../session/next';
import { SEE_THROUGH, materialIn, type Material } from '../elements/material/schema';
import { setFloorLayers } from '../elements/room/commands';
import { FLOOR_BUILDUPS, type FloorLayer } from '../elements/room/schema';
import { previewMesh } from '../elements/object/textures';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { materialLabel, type MessageKey, t } from '../i18n/messages';
import { meshSnapshot } from './object-snapshot';
import { lengthText } from '../i18n/units';
import { iconButton, storeSearch } from './store-parts';

const SIDE = 1;
/** How much each layer under the top one reaches out further at the front corner (m). */
const STEP = 0.1;

/** A build-up's sample as a data URL; null with no WebGL. */
export function floorSnapshot(layers: readonly FloorLayer[], materials: readonly Material[], w: number, h: number): string | null {
  const meshes: THREE.Mesh[] = [];
  // From the top down: each layer below a step larger, so its edge shows under the one above.
  let top = 0;
  layers.forEach((l, i) => {
    const t = Math.max(0.001, l.thickness);
    const size = SIDE + i * STEP;
    const g = new THREE.BoxGeometry(size, t, size);
    g.translate(size / 2 - SIDE / 2, top - t / 2, size / 2 - SIDE / 2);
    const m = materialIn(materials, l.materialId);
    meshes.push(previewMesh(g, m, SEE_THROUGH[m.id]));
    top -= t;
  });
  return meshSnapshot(meshes, w, h, 0.7, 0.55);
}

const pictures = new Map<string, string | null>();
function pictureOf(key: string, materials: readonly Material[], make: boolean, w = 360, h = 270): string | null | undefined {
  const k = `${key}@${w}x${h}`;
  if (!pictures.has(k) && make) pictures.set(k, floorSnapshot(FLOOR_BUILDUPS[key]!, materials, w, h));
  return pictures.get(k);
}

export function showFloors(app: App): void {
  const keys = Object.keys(FLOOR_BUILDUPS);
  let chosen = keys[0]!;
  let query = '';
  let scrolled: number | null = null;
  let pending: string[] = [];
  let working = false;
  const work = () => {
    if (working) return;
    working = true;
    const step = () => {
      const k = pending.shift();
      const host = app.shell.helpBack;
      if (!k || !host.querySelector('.objs-store')) {
        working = false;
        return;
      }
      const src = pictureOf(k, app.store.get().materials, true);
      const img = host.querySelector<HTMLImageElement>(`img[data-picture="${CSS.escape(k)}"]`);
      if (img && src) {
        img.src = src;
        img.classList.remove('is-loading');
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const nameOf = (k: string) => t(`floor.buildup.${k}` as MessageKey);
    const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const shown = keys.filter((k) => query.trim() === '' || fold(nameOf(k)).includes(fold(query.trim())));
    if (!shown.includes(chosen)) chosen = shown[0] ?? '';
    const selected = doc.floors.filter((f) => app.ui.selection.has(f.id));
    const total = (k: string) => FLOOR_BUILDUPS[k]!.reduce((s, l) => s + l.thickness, 0);

    const search = storeSearch(t('flstore.search'), query, (value) => {
      query = value;
      scrolled = 0;
      dialog.redraw();
    });
    const closeBtn = iconButton('close', t('help.close'), 'close', close);
    const head = el('div', { class: 'objs-head' }, el('h2', {}, t('flstore.title')), search, el('span', { class: 'objs-total' }, t('flstore.count', { n: shown.length })), closeBtn);

    pending = [];
    const grid = el('div', { class: 'objs-grid', role: 'group', 'aria-label': t('flstore.title') });
    grid.addEventListener('scroll', () => (scrolled = grid.scrollTop));
    if (scrolled !== null) {
      const top = scrolled;
      requestAnimationFrame(() => (grid.scrollTop = top));
    }
    for (const k of shown) {
      const card = el('button', { type: 'button', class: 'objs-card', 'aria-pressed': String(k === chosen) });
      card.dataset.focus = `buildup:${k}`;
      const src = pictureOf(k, doc.materials, false);
      const img = el('img', { class: `objs-card-img${src ? '' : ' is-loading'}`, alt: '', 'data-picture': k });
      if (src) img.src = src;
      else if (src === undefined) pending.push(k);
      const n = FLOOR_BUILDUPS[k]!.length;
      card.append(el('span', { class: 'objs-card-pic' }, img), el('span', { class: 'objs-card-name' }, nameOf(k)), el('span', { class: 'objs-card-meta' }, `${lengthText(total(k))} · ${n === 1 ? t('types.layerOne') : t('types.layerCount', { n })}`));
      card.addEventListener('click', () => {
        chosen = k;
        dialog.redraw();
      });
      grid.append(card);
    }
    if (shown.length === 0) grid.append(el('p', { class: 'objs-empty' }, t('flstore.noMatch')));

    const side = el('aside', { class: 'objs-side' });
    if (chosen) {
      const layers = FLOOR_BUILDUPS[chosen]!;
      const picture = pictureOf(chosen, doc.materials, true, 640, 480);
      side.append(picture ? el('img', { class: 'objs-preview', src: picture, alt: nameOf(chosen) }) : el('div', { class: 'objs-preview' }));
      side.append(el('h3', { class: 'objs-name' }, nameOf(chosen)), el('p', { class: 'objs-folder-line' }, t('flstore.total', { t: lengthText(total(chosen)) })));
      const list = el('ol', { class: 'flstore-layers' });
      for (const l of layers) list.append(el('li', {}, el('span', {}, materialLabel(materialIn(doc.materials, l.materialId))), el('span', { class: 'flstore-t' }, lengthText(l.thickness))));
      side.append(el('div', { class: 'objs-label' }, t('flstore.layers')), list);
      const go = el('button', { type: 'button', class: 'objs-place' }, selected.length === 1 ? t('flstore.applyOne') : selected.length > 1 ? t('flstore.apply', { n: selected.length }) : t('flstore.draw'));
      go.dataset.focus = 'place';
      go.addEventListener('click', () => {
        close();
        if (selected.length > 0) app.store.dispatch(setFloorLayers(selected.map((f) => f.id), layers));
        else {
          // The floor tool's next floor of this build-up, its thickness theirs.
          app.next = { ...app.next, floors: { ...nextOf(app, 'floors'), layers, thickness: total(chosen) } };
          app.setTool('floor');
        }
      });
      side.append(go, el('p', { class: 'objs-in-project' }, selected.length > 0 ? t('flstore.applyNote') : t('flstore.drawNote')));
    }
    work();
    return withLibrary(app, 'floors', close, el('div', { class: 'dialog objs-store flstore', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('flstore.title') }, head, el('div', { class: 'objs-main' }, grid, side)));
  };
  const dialog = openProjectDialog(app, render, () => `buildup:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="buildup:${chosen}"]`)?.focus({ preventScroll: true });
}
