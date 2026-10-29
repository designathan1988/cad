// The project's objects (phase 4): its library of parametric definitions. Each with how many are placed;
// place, new, duplicate, edit (definition-editor.ts), delete (not one placed or nested in another), and library
// files: export the definitions as JSON, import a file of them (checked as the project file checks them,
// an id the project already has gets a new one). Laid out as the wall types and the materials.

import type { App } from '../app/app';
import type { Doc } from '../app/document';
import { copyLibraryLink } from '../app/library-link';
import { newId } from '../core/id';
import { addDefinition, definitionDeleteBlocker, deleteDefinition } from '../elements/object/commands';
import { evaluateObject, pieceOutline, pieceSpan } from '../elements/object/evaluate';
import { words } from '../elements/object/fields';
import { DEFINITION_PREFIX, type ObjectDefinition } from '../elements/object/schema';
import { libraryOf, mergeLibrary } from '../io/library-file';
import { blockedBy, el } from './controls';
import { openProjectDialog } from './dialog';
import { editDefinition } from './definition-editor';
import { defaultName, getLang, type MessageKey, nextCopy, t } from './i18n';
import { icon } from './icons';
import { objectSnapshot } from './object-snapshot';
import { lengthText } from './units';

/** A new definition: one box, its width, depth and height, handles on them, one type. */
export function blankDefinition(n: number): ObjectDefinition {
  const len = (name: string, pt: string, en: string, v: number) => ({ name, label: { pt, en }, kind: 'length' as const, default: v, min: 0.01, max: 10, step: 0.005 });
  return {
    id: newId(DEFINITION_PREFIX),
    name: { pt: `Objeto ${n}`, en: `Object ${n}` },
    category: 'generic',
    params: [len('largura', 'Largura', 'Width', 0.6), len('profundidade', 'Profundidade', 'Depth', 0.6), len('altura', 'Altura', 'Height', 0.75), { name: 'mat', label: { pt: 'Material', en: 'Material' }, kind: 'material', default: 'wood' }],
    parts: [{ kind: 'box', name: { pt: 'Caixa', en: 'Box' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: 'mat' }],
    handles: [
      { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
      { param: 'profundidade', axis: 'y', at: [0, 'profundidade/2', 'altura'], shift: 0.5 },
      { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
    ],
    types: [{ id: 'standard', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
  };
}

/** The folder a definition is kept in: its own, or its category's name. */
export const folderOf = (d: ObjectDefinition): string => d.folder?.trim() || t(`ed.cat.${d.category}` as MessageKey);

/** Text for comparing: no accents, no case. */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Whether a definition answers a search: by its name in either language or its folder. */
export const answers = (d: ObjectDefinition, query: string): boolean => {
  const q = fold(query.trim());
  return q === '' || [d.name.pt, d.name.en, folderOf(d)].some((s) => fold(s).includes(q));
};

/** A definition's thumbnail: its pieces in plan at its first type, the highest drawn last, in their materials' colours. */
export function thumbnailSvg(def: ObjectDefinition, doc: Doc): string | null {
  const ev = evaluateObject(def, { id: 'thumb', levelId: '', definitionId: def.id, typeId: def.types[0]?.id ?? '', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: doc.definitions, materials: doc.materials });
  const rings = [...ev.pieces].filter((p) => !p.cut).sort((a, b) => a.z + a.h - (b.z + b.h)).map((p) => ({ ring: pieceOutline(p), color: /^#[0-9a-f]{3,8}$/i.test(p.material.color) ? p.material.color : 'none' }));
  const all = rings.flatMap((r) => r.ring);
  if (all.length === 0) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => -p.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1e-3);
  const pad = size * 0.08;
  const f = (v: number) => Number(v.toFixed(4));
  const polys = rings.map((r) => `<polygon points="${r.ring.map((p) => `${f(p.x)},${f(-p.y)}`).join(' ')}" fill="${r.color}" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('');
  return `<svg viewBox="${f(x0 - pad)} ${f(y0 - pad)} ${f(size + 2 * pad)} ${f(size + 2 * pad)}" aria-hidden="true">${polys}</svg>`;
}

/** Pictures of the definitions (object-snapshot.ts), by the project's materials, the definition and the type: made once each. */
const pictures = new WeakMap<object, WeakMap<ObjectDefinition, Map<string, string | null>>>();
function pictureOf(doc: Doc, def: ObjectDefinition, typeId: string, make: boolean, w = 360, h = 270): string | null | undefined {
  let byDef = pictures.get(doc.materials);
  if (!byDef) pictures.set(doc.materials, (byDef = new WeakMap()));
  let byType = byDef.get(def);
  if (!byType) byDef.set(def, (byType = new Map()));
  const key = `${typeId}@${w}x${h}`;
  if (!byType.has(key) && make) byType.set(key, objectSnapshot(def, doc, w, h, typeId));
  return byType.get(key);
}

/** An object's size at a type, from its pieces: across, deep and high (m). */
function sizeOf(def: ObjectDefinition, doc: Doc, typeId: string): { w: number; d: number; h: number } | null {
  const ev = evaluateObject(def, { id: 'size', levelId: '', definitionId: def.id, typeId, at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: {} }, { definitions: doc.definitions, materials: doc.materials });
  const solid = ev.pieces.filter((p) => !p.cut);
  if (solid.length === 0) return null;
  const pts = solid.flatMap((p) => pieceOutline(p));
  const spans = solid.map((p) => pieceSpan(p));
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys), h: Math.max(...spans.map((s) => s.top)) - Math.min(0, ...spans.map((s) => s.bottom)) };
}

/** The store's own folders: every object, and those placed in the project. */
const ALL = '';
const PLACED = '\u0001placed';

/**
 * The project's objects as a store: the folders down the side with how many each holds (every object,
 * those in the project), the objects as cards with their pictures in 3D, and the chosen one beside them:
 * its picture at the type chosen, its size, its types to choose from, and placing it as the main action.
 * The library's own actions (new, import, export) are in a menu, not among the object's.
 */
export function showObjects(app: App, first?: string): void {
  let chosen = first ?? app.store.get().definitions[0]?.id ?? '';
  let query = '';
  let folder = ALL;
  let menu = false;
  // Where the cards were scrolled: kept as the dialog redraws (a type chosen, a card), back to the top for
  // another folder or search; null until drawn (the chosen card is brought into view then).
  let scrolled: number | null = null;
  const typeOf = new Map<string, string>();
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void importLibrary(app, file).then((said) => app.toast(said));
  });
  // Pictures not made yet, made one at a time after the dialog is drawn, each put in its card when ready.
  let pending: ObjectDefinition[] = [];
  let working = false;
  const work = () => {
    if (working) return;
    working = true;
    const step = () => {
      const def = pending.shift();
      const host = app.shell.helpBack;
      if (!def || !host.querySelector('.objs-store')) {
        working = false;
        return;
      }
      const doc = app.store.get();
      const typeId = def.types[0]?.id ?? '';
      const src = pictureOf(doc, def, typeId, true);
      const img = host.querySelector<HTMLImageElement>(`img[data-picture="${CSS.escape(def.id)}"]`);
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
    const lang = getLang() === 'pt' ? 'pt-BR' : 'en';
    const placed = (id: string) => doc.objects.filter((o) => o.definitionId === id).length;
    const byName = (a: ObjectDefinition, b: ObjectDefinition) => words(a.name).localeCompare(words(b.name), lang);
    // The folders, each with how many it holds of what the search leaves.
    const found = doc.definitions.filter((x) => answers(x, query));
    const counts = new Map<string, number>();
    for (const d of found) counts.set(folderOf(d), (counts.get(folderOf(d)) ?? 0) + 1);
    const inProject = found.filter((d) => placed(d.id) > 0);
    const shown = (folder === ALL ? found : folder === PLACED ? inProject : found.filter((d) => folderOf(d) === folder)).sort(byName);
    if (!shown.some((d) => d.id === chosen)) chosen = shown[0]?.id ?? '';
    const def = shown.find((d) => d.id === chosen);
    const typeId = def ? (typeOf.get(def.id) ?? def.types[0]?.id ?? '') : '';

    // The head: title, search, how many, the library's menu, close.
    const search = el('input', { type: 'search', class: 'objs-search', placeholder: t('objs.search'), 'aria-label': t('objs.search') });
    search.value = query;
    search.dataset.focus = 'search';
    search.addEventListener('input', () => {
      query = search.value;
      // A search is through every object: a folder chosen before hid most of what it finds.
      if (query.trim() !== '') folder = ALL;
      scrolled = 0;
      dialog.redraw();
    });
    const iconBtn = (name: Parameters<typeof icon>[0], label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label });
      b.innerHTML = icon(name, 18);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    const more = iconBtn('more', t('objs.more'), 'more', () => {
      menu = !menu;
      dialog.redraw();
    });
    more.setAttribute('aria-expanded', String(menu));
    // Its tip stood over the menu it opens: none while it is open.
    if (menu) more.removeAttribute('title');
    const menuItem = (label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'objs-menu-item', role: 'menuitem' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', () => {
        menu = false;
        run();
      });
      return b;
    };
    const libraryMenu = el(
      'div',
      { class: 'objs-menu', role: 'menu', 'aria-label': t('objs.more') },
      menuItem(t('objs.new'), 'new', () => {
        const fresh = blankDefinition(doc.definitions.length + 1);
        close();
        editDefinition(app, fresh, true, () => showObjects(app, fresh.id));
      }),
      menuItem(t('objs.import'), 'import', () => fileInput.click()),
      // The file: every definition with the materials they use (io/library-file.ts).
      menuItem(t('objs.export'), 'export', () => {
        const text = JSON.stringify(libraryOf(app.store.get(), null), null, 2);
        app.download(`${app.fileBase()}-objetos.json`, new Blob([text], { type: 'application/json' }), 'application/json');
        dialog.redraw();
      }),
    );
    libraryMenu.hidden = !menu;
    const head = el(
      'div',
      { class: 'objs-head' },
      el('h2', {}, t('objs.title')),
      search,
      el('span', { class: 'objs-total' }, t('objs.countAll', { n: found.length })),
      el('div', { class: 'objs-menu-wrap' }, more, libraryMenu),
      iconBtn('close', t('help.close'), 'close', close),
      fileInput,
    );

    // The folders down the side.
    const nav = el('nav', { class: 'objs-nav', 'aria-label': t('objs.folders') });
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
    nav.append(navItem(ALL, t('objs.all'), found.length), navItem(PLACED, t('objs.inProject'), inProject.length), el('div', { class: 'objs-nav-head' }, t('objs.folders')));
    for (const name of [...counts.keys()].sort((x, y) => x.localeCompare(y, lang))) nav.append(navItem(name, name, counts.get(name)!));

    // The cards.
    pending = [];
    const grid = el('div', { class: 'objs-grid', role: 'group', 'aria-label': t('objs.list') });
    grid.addEventListener('scroll', () => (scrolled = grid.scrollTop));
    if (scrolled !== null) {
      const top = scrolled;
      requestAnimationFrame(() => (grid.scrollTop = top));
    }
    for (const d of shown) {
      const card = el('button', { type: 'button', class: 'objs-card', 'aria-pressed': String(d.id === chosen) });
      card.dataset.focus = `def:${d.id}`;
      const src = pictureOf(doc, d, d.types[0]?.id ?? '', false);
      const img = el('img', { class: `objs-card-img${src ? '' : ' is-loading'}`, alt: '', 'data-picture': d.id });
      if (src) img.src = src;
      else if (src === undefined) pending.push(d);
      const n = placed(d.id);
      card.append(
        el('span', { class: 'objs-card-pic' }, img, ...(n > 0 ? [el('span', { class: 'objs-badge' }, t('objs.badge', { n }))] : [])),
        el('span', { class: 'objs-card-name' }, words(d.name)),
        el('span', { class: 'objs-card-meta' }, `${folderOf(d)} · ${d.types.length === 1 ? t('objs.typeOne') : t('objs.types', { n: d.types.length })}`),
      );
      card.addEventListener('click', () => {
        chosen = d.id;
        dialog.redraw();
      });
      card.addEventListener('dblclick', () => {
        close();
        app.placeObject(d.id, typeOf.get(d.id) ?? d.types[0]?.id);
      });
      grid.append(card);
    }
    if (shown.length === 0) grid.append(el('p', { class: 'objs-empty' }, folder === PLACED && query === '' ? t('objs.noneInProject') : t('objs.noMatch')));

    // The chosen one.
    const side = el('aside', { class: 'objs-side' });
    if (def) {
      const picture = pictureOf(doc, def, typeId, true, 640, 480);
      side.append(picture ? el('img', { class: 'objs-preview', src: picture, alt: words(def.name) }) : el('div', { class: 'objs-preview' }));
      side.append(el('h3', { class: 'objs-name' }, words(def.name)), el('p', { class: 'objs-folder-line' }, folderOf(def)));
      const size = sizeOf(def, doc, typeId);
      if (size) {
        const dim = (label: string, v: number) => el('div', { class: 'objs-dim' }, el('span', { class: 'objs-dim-label' }, label), el('span', { class: 'objs-dim-value' }, lengthText(v)));
        side.append(el('div', { class: 'objs-dims', 'aria-label': t('objs.size') }, dim(t('objs.width'), size.w), dim(t('objs.depth'), size.d), dim(t('objs.height'), size.h)));
      }
      if (def.types.length > 1) {
        const types = el('div', { class: 'objs-types', role: 'radiogroup', 'aria-label': t('objs.typeToPlace') });
        for (const ty of def.types) {
          const b = el('button', { type: 'button', class: 'objs-type', role: 'radio', 'aria-checked': String(ty.id === typeId) }, words(ty.name));
          b.dataset.focus = `type:${ty.id}`;
          b.addEventListener('click', () => {
            typeOf.set(def.id, ty.id);
            dialog.redraw();
          });
          types.append(b);
        }
        side.append(el('div', { class: 'objs-label' }, t('objs.typeToPlace')), types);
      }
      // Placing it: the ribbon shows only some of the library (app/ribbon-tabs.ts), this places any, of the type chosen.
      const place = el('button', { type: 'button', class: 'objs-place' }, t('objs.place'));
      place.dataset.focus = 'place';
      place.addEventListener('click', () => {
        close();
        app.placeObject(def.id, typeId);
      });
      const textBtn = (label: string, focus: string, run: () => void) => {
        const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
        b.dataset.focus = focus;
        b.addEventListener('click', run);
        return b;
      };
      // Editing opens the editor in this dialog's place; it comes back here when closed.
      const edit = textBtn(t('objs.edit'), 'edit', () => (close(), editDefinition(app, def, false, () => showObjects(app, def.id))));
      const dup = textBtn(t('objs.duplicate'), 'duplicate', () => {
        const defs = app.store.get().definitions;
        const pt = nextCopy(def.name.pt, defs.map((x) => x.name.pt));
        const en = nextCopy(def.name.en, defs.map((x) => x.name.en));
        const n = Math.max(pt.n, en.n);
        const copy: ObjectDefinition = { ...def, id: newId(DEFINITION_PREFIX), name: { pt: defaultName.copy(pt.base, n), en: defaultName.copy(en.base, n) } };
        chosen = copy.id;
        app.store.dispatch(addDefinition(copy));
      });
      // The chosen one by link: with what it nests and the materials it uses.
      const link = textBtn(t('lib.copyLink'), 'link', () => void copyLibraryLink(app, libraryOf(app.store.get(), [def.id])));
      const blocker = definitionDeleteBlocker(doc, def.id);
      const action = t('objs.deleteNamed', { name: words(def.name) });
      const why = blocker === 'inUse' ? t('objs.cantDeleteInUse') : blocker === 'nested' ? t('objs.cantDeleteNested') : null;
      const del = iconBtn('trash', action, 'delete', () => app.store.dispatch(deleteDefinition(def.id)));
      const whyNode = blockedBy(del, action, why, 'objs-why');
      const n = placed(def.id);
      side.append(
        place,
        el('p', { class: 'objs-in-project' }, n === 0 ? t('objs.none') : n === 1 ? t('objs.placedOne') : t('objs.placed', { n })),
        el('div', { class: 'objs-side-actions' }, edit, dup, link, el('span', { class: 'spacer' }), del, ...(whyNode ? [whyNode] : [])),
        el('p', { class: 'objs-summary' }, t('objs.summary', { p: def.params.length, k: def.parts.length, h: def.handles.length, t: def.types.length })),
      );
    }
    work();
    return el(
      'div',
      { class: 'dialog objs-store', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('objs.title') },
      head,
      el('div', { class: 'objs-main' }, nav, grid, side),
    );
  };
  const dialog = openProjectDialog(app, render, () => `def:${chosen}`);
  const card = app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="def:${chosen}"]`);
  card?.focus({ preventScroll: true });
  card?.scrollIntoView({ block: 'center' });
  scrolled = app.shell.helpBack.querySelector('.objs-grid')?.scrollTop ?? 0;
}

/**
 * A library file read into the project (io/library-file.ts): its valid definitions and materials added,
 * new ids where taken, as one undo step; and what was done.
 */
async function importLibrary(app: App, file: File): Promise<string> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    return t('objs.importBad', { error: e instanceof Error ? e.message : String(e) });
  }
  const r = mergeLibrary(app.store.get(), raw);
  if (!r.ok) return t('objs.importBad', { error: t('objs.importNoList') });
  app.store.dispatch({
    label: 'cmd.importLibrary',
    apply: (doc) => {
      const x = mergeLibrary(doc, raw);
      return x.ok ? x.doc : doc;
    },
  });
  return t('lib.imported', { defs: r.definitions, mats: r.materials, bad: r.bad, same: r.same });
}
