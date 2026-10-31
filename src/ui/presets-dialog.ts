// The structure and access store: the ready-made columns, beams, stairs and railings (elements/presets.ts)
// as cards, each pictured with the element's own 3D geometry (its kind's solid, derived as the tool's
// next element is), folders by kind, and placing one as the main action (its tool, the next element of
// that model). Laid out as the objects' store (objects-dialog.ts), with its styles.

import { withLibrary } from './library-tabs';
import type { App } from '../session/app';
import { nextOf } from '../session/next';
import type { KindSolid } from '../elements/contract';
import { SEE_THROUGH } from '../elements/material/schema';
import type { Words } from '../elements/object/schema';
import { PRESET_TOOL, PRESETS, type Preset, type PresetSlot } from '../elements/presets';
import { kindOfKey, withList } from '../elements/registry';
import { previewMesh } from '../elements/object/textures';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { getLang, type MessageKey, t } from '../i18n/messages';
import { meshSnapshot } from './object-snapshot';
import { folderButton, iconButton, storeSearch } from './store-parts';

const words = (x: Words) => (getLang() === 'pt' ? x.pt : x.en);
/** The scene's own materials, as the 3D view's (scene-3d.ts) in the light style. */
const SCENE: Record<'side' | 'floor' | 'roof', { color: string; roughness: number; metalness: number }> = {
  side: { color: '#d9d6d0', roughness: 0.85, metalness: 0 },
  floor: { color: '#bdb7ad', roughness: 0.9, metalness: 0 },
  roof: { color: '#9a6b52', roughness: 0.8, metalness: 0 },
};

/** The element the preset makes, as the tool's next one with its properties. */
const templateOf = (app: App, p: Preset) => ({ ...nextOf(app, p.slot), ...p.patch });

/** Its picture as a data URL; null when it derives nothing or there is no WebGL. */
function snapshot(app: App, p: Preset, w: number, h: number): string | null {
  const kind = kindOfKey(p.slot);
  // Pictured short and from higher up, so a column's or a beam's section reads (an I, an H, an L).
  const short = p.slot === 'columns' ? { topOffset: -1.6 } : p.slot === 'beams' ? { end: { x: 1.2, y: 0 } } : {};
  const template = { ...templateOf(app, p), ...short };
  const doc = withList(app.store.get(), kind, [template]);
  const s = kind.derive(doc, template, app.geometry);
  if (s === null || !kind.solid) return null;
  const made = kind.solid(s);
  if (!made) return null;
  const meshes = (Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid]).map((part) => {
    const m = typeof part.material === 'string' ? { id: part.material, ...SCENE[part.material] } : part.material;
    const mesh = previewMesh(part.geometry.clone(), m, SEE_THROUGH[m.id]);
    mesh.position.y = part.y;
    return mesh;
  });
  const pitch = p.slot === 'columns' || p.slot === 'beams' ? 0.8 : p.slot === 'roofs' ? 0.55 : 0.4;
  return meshes.length > 0 ? meshSnapshot(meshes, w, h, 0.65, pitch) : null;
}

const pictures = new Map<string, string | null>();
function pictureOf(app: App, p: Preset, make: boolean, w = 360, h = 270): string | null | undefined {
  const key = `${p.id}@${w}x${h}`;
  if (!pictures.has(key) && make) pictures.set(key, snapshot(app, p, w, h));
  return pictures.get(key);
}

const FOLDERS: readonly PresetSlot[] = ['columns', 'beams', 'stairs', 'railings', 'roofs', 'curtains'];

/** The folder of a tool's models, if it has any. */
export const presetSlotOf = (tool: string): PresetSlot | undefined => FOLDERS.find((f) => PRESET_TOOL[f] === tool);

export function showPresets(app: App, slot?: PresetSlot): void {
  let folder: PresetSlot | 'all' = slot ?? 'all';
  let chosen = PRESETS.find((p) => p.slot === (slot ?? 'columns'))!.id;
  let query = '';
  let pending: Preset[] = [];
  let working = false;
  const work = () => {
    if (working) return;
    working = true;
    const step = () => {
      const p = pending.shift();
      const host = app.shell.helpBack;
      if (!p || !host.querySelector('.objs-store')) {
        working = false;
        return;
      }
      const src = pictureOf(app, p, true);
      const img = host.querySelector<HTMLImageElement>(`img[data-picture="${CSS.escape(p.id)}"]`);
      if (img && src) {
        img.src = src;
        img.classList.remove('is-loading');
      }
      setTimeout(step, 0);
    };
    setTimeout(step, 0);
  };
  const render = (close: () => void): HTMLElement => {
    const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const folderName = (f: PresetSlot) => t(`prstore.${f}` as MessageKey);
    const found = PRESETS.filter((p) => query.trim() === '' || fold(`${words(p.name)} ${folderName(p.slot)}`).includes(fold(query.trim())));
    const shown = folder === 'all' ? found : found.filter((p) => p.slot === folder);
    if (!shown.some((p) => p.id === chosen)) chosen = shown[0]?.id ?? '';
    const preset = shown.find((p) => p.id === chosen);

    const search = storeSearch(t('prstore.search'), query, (value) => {
      query = value;
      if (query.trim() !== '') folder = 'all';
      dialog.redraw();
    });
    const closeBtn = iconButton('close', t('help.close'), 'close', close);
    const head = el('div', { class: 'objs-head' }, el('h2', {}, t('prstore.title')), search, el('span', { class: 'objs-total' }, t('opstore.count', { n: found.length })), closeBtn);

    const nav = el('nav', { class: 'objs-nav', 'aria-label': t('objs.folders') });
    const navItem = (key: PresetSlot | 'all', label: string, n: number) =>
      folderButton(key, label, n, folder === key, () => {
        folder = key;
        dialog.redraw();
      });
    nav.append(navItem('all', t('opstore.all'), found.length), ...FOLDERS.map((f) => navItem(f, folderName(f), found.filter((p) => p.slot === f).length)));

    const place = (p: Preset) => {
      close();
      app.next = { ...app.next, [p.slot]: templateOf(app, p) };
      app.setTool(PRESET_TOOL[p.slot]);
    };
    pending = [];
    const grid = el('div', { class: 'objs-grid', role: 'group', 'aria-label': t('prstore.title') });
    for (const p of shown) {
      const card = el('button', { type: 'button', class: 'objs-card', 'aria-pressed': String(p.id === chosen) });
      card.dataset.focus = `preset:${p.id}`;
      const src = pictureOf(app, p, false);
      const img = el('img', { class: `objs-card-img${src ? '' : ' is-loading'}`, alt: '', 'data-picture': p.id });
      if (src) img.src = src;
      else if (src === undefined) pending.push(p);
      card.append(el('span', { class: 'objs-card-pic' }, img), el('span', { class: 'objs-card-name' }, words(p.name)), el('span', { class: 'objs-card-meta' }, folderName(p.slot)));
      card.addEventListener('click', () => {
        chosen = p.id;
        dialog.redraw();
      });
      card.addEventListener('dblclick', () => place(p));
      grid.append(card);
    }
    if (shown.length === 0) grid.append(el('p', { class: 'objs-empty' }, t('opstore.noMatch')));

    const side = el('aside', { class: 'objs-side' });
    if (preset) {
      const picture = pictureOf(app, preset, true, 640, 480);
      side.append(picture ? el('img', { class: 'objs-preview', src: picture, alt: words(preset.name) }) : el('div', { class: 'objs-preview' }));
      side.append(el('h3', { class: 'objs-name' }, words(preset.name)), el('p', { class: 'objs-folder-line' }, folderName(preset.slot)));
      const go = el('button', { type: 'button', class: 'objs-place' }, t('objs.place'));
      go.dataset.focus = 'place';
      go.addEventListener('click', () => place(preset));
      side.append(go, el('p', { class: 'objs-in-project' }, t('prstore.after')));
    }
    work();
    return withLibrary(app, 'presets', close, el('div', { class: 'dialog objs-store', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('prstore.title') }, head, el('div', { class: 'objs-main' }, nav, grid, side)));
  };
  const dialog = openProjectDialog(app, render, () => `preset:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="preset:${chosen}"]`)?.focus({ preventScroll: true });
}
