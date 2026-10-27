// The doors and windows store: the models the tools make (elements/opening/style.ts) as cards with their
// pictures in 3D in a piece of wall, doors and windows as folders, the chosen one beside them with its
// size, how it opens, and placing it as the main action (the door or window tool, its next one of that
// model and size). Laid out as the objects' store (objects-dialog.ts), with its styles.

import type { App } from '../app/app';
import type { OpeningKind } from '../elements/opening/schema';
import { OPENING_MODELS, type OpeningModel } from '../elements/opening/style';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, t } from './i18n';
import { icon } from './icons';
import { openingSnapshot } from './opening-snapshot';
import { lengthText } from './units';

/** Pictures made once each, by model and size. */
const pictures = new Map<string, string | null>();
function pictureOf(m: OpeningModel, make: boolean, w = 360, h = 270): string | null | undefined {
  const key = `${m.id}@${w}x${h}`;
  if (!pictures.has(key) && make) pictures.set(key, openingSnapshot(m, w, h));
  return pictures.get(key);
}

const nameOf = (m: OpeningModel) => t(`model.${m.id}` as MessageKey);

export function showOpenings(app: App, kind?: OpeningKind): void {
  let folder: OpeningKind | 'all' = kind ?? 'all';
  let chosen = OPENING_MODELS.find((m) => m.kind === (kind ?? 'door'))?.id ?? OPENING_MODELS[0]!.id;
  let query = '';
  let scrolled: number | null = null;
  let pending: OpeningModel[] = [];
  let working = false;
  // Pictures not made yet, made one at a time after the dialog shows.
  const work = () => {
    if (working) return;
    working = true;
    const step = () => {
      const m = pending.shift();
      const host = app.shell.helpBack;
      if (!m || !host.querySelector('.objs-store')) {
        working = false;
        return;
      }
      const src = pictureOf(m, true);
      const img = host.querySelector<HTMLImageElement>(`img[data-picture="${CSS.escape(m.id)}"]`);
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
    const found = OPENING_MODELS.filter((m) => query.trim() === '' || fold(`${nameOf(m)} ${t(m.kind === 'door' ? 'opstore.doors' : 'opstore.windows')}`).includes(fold(query.trim())));
    const shown = folder === 'all' ? found : found.filter((m) => m.kind === folder);
    if (!shown.some((m) => m.id === chosen)) chosen = shown[0]?.id ?? '';
    const model = shown.find((m) => m.id === chosen);

    const search = el('input', { type: 'search', class: 'objs-search', placeholder: t('opstore.search'), 'aria-label': t('opstore.search') });
    search.value = query;
    search.dataset.focus = 'search';
    search.addEventListener('input', () => {
      query = search.value;
      if (query.trim() !== '') folder = 'all';
      scrolled = 0;
      dialog.redraw();
    });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn', 'aria-label': t('help.close'), title: t('help.close') });
    closeBtn.innerHTML = icon('close', 18);
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    const head = el('div', { class: 'objs-head' }, el('h2', {}, t('opstore.title')), search, el('span', { class: 'objs-total' }, t('opstore.count', { n: found.length })), closeBtn);

    const nav = el('nav', { class: 'objs-nav', 'aria-label': t('objs.folders') });
    const navItem = (key: OpeningKind | 'all', label: string, n: number) => {
      const b = el('button', { type: 'button', class: 'objs-nav-item', 'aria-pressed': String(folder === key) }, el('span', { class: 'objs-nav-name' }, label), el('span', { class: 'objs-nav-count' }, String(n)));
      b.dataset.focus = `folder:${key}`;
      b.addEventListener('click', () => {
        folder = key;
        scrolled = 0;
        dialog.redraw();
      });
      return b;
    };
    nav.append(
      navItem('all', t('opstore.all'), found.length),
      navItem('door', t('opstore.doors'), found.filter((m) => m.kind === 'door').length),
      navItem('window', t('opstore.windows'), found.filter((m) => m.kind === 'window').length),
    );

    pending = [];
    const grid = el('div', { class: 'objs-grid', role: 'group', 'aria-label': t('opstore.title') });
    grid.addEventListener('scroll', () => (scrolled = grid.scrollTop));
    if (scrolled !== null) {
      const top = scrolled;
      requestAnimationFrame(() => (grid.scrollTop = top));
    }
    const place = (m: OpeningModel) => {
      close();
      const ui = app.ui;
      ui.openingDefaults = { ...ui.openingDefaults, [m.kind]: { ...ui.openingDefaults[m.kind], style: m.style, width: m.width, height: m.height, sill: m.sill } };
      app.setTool(m.kind);
    };
    for (const m of shown) {
      const card = el('button', { type: 'button', class: 'objs-card', 'aria-pressed': String(m.id === chosen) });
      card.dataset.focus = `model:${m.id}`;
      const src = pictureOf(m, false);
      const img = el('img', { class: `objs-card-img${src ? '' : ' is-loading'}`, alt: '', 'data-picture': m.id });
      if (src) img.src = src;
      else if (src === undefined) pending.push(m);
      card.append(
        el('span', { class: 'objs-card-pic' }, img),
        el('span', { class: 'objs-card-name' }, nameOf(m)),
        el('span', { class: 'objs-card-meta' }, `${t(m.kind === 'door' ? 'opstore.door' : 'opstore.window')} · ${lengthText(m.width)} × ${lengthText(m.height)}`),
      );
      card.addEventListener('click', () => {
        chosen = m.id;
        dialog.redraw();
      });
      card.addEventListener('dblclick', () => place(m));
      grid.append(card);
    }
    if (shown.length === 0) grid.append(el('p', { class: 'objs-empty' }, t('opstore.noMatch')));

    const side = el('aside', { class: 'objs-side' });
    if (model) {
      const picture = pictureOf(model, true, 640, 480);
      side.append(picture ? el('img', { class: 'objs-preview', src: picture, alt: nameOf(model) }) : el('div', { class: 'objs-preview' }));
      side.append(el('h3', { class: 'objs-name' }, nameOf(model)), el('p', { class: 'objs-folder-line' }, `${t(model.kind === 'door' ? 'opstore.door' : 'opstore.window')} · ${t(`op.${model.kind}.${model.style.operation}` as MessageKey)}`));
      const dim = (label: string, v: number) => el('div', { class: 'objs-dim' }, el('span', { class: 'objs-dim-label' }, label), el('span', { class: 'objs-dim-value' }, lengthText(v)));
      side.append(el('div', { class: 'objs-dims', 'aria-label': t('objs.size') }, dim(t('objs.width'), model.width), dim(t('objs.height'), model.height), dim(t('opstore.sill'), model.sill)));
      const facts = [
        model.style.leaves === 1 ? t('opstore.leafOne') : t('opstore.leaves', { n: model.style.leaves }),
        ...(model.style.transom > 0 ? [t('opstore.transom', { h: lengthText(model.style.transom) })] : []),
        ...(model.style.threshold ? [t('opstore.threshold')] : []),
        t('opstore.frame', { f: lengthText(model.style.frame) }),
      ];
      side.append(el('p', { class: 'objs-summary' }, facts.join(' · ')));
      const go = el('button', { type: 'button', class: 'objs-place' }, t('objs.place'));
      go.dataset.focus = 'place';
      go.addEventListener('click', () => place(model));
      side.append(go, el('p', { class: 'objs-in-project' }, t('opstore.after')));
    }
    work();
    return el('div', { class: 'dialog objs-store', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('opstore.title') }, head, el('div', { class: 'objs-main' }, nav, grid, side));
  };
  const dialog = openProjectDialog(app, render, () => `model:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="model:${chosen}"]`)?.focus({ preventScroll: true });
}
