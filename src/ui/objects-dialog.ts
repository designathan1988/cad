// The project's objects (phase 4): its library of parametric definitions. Each with how many are placed;
// place, new, duplicate, edit (definition-editor.ts), delete (not one placed or nested in another), and library
// files: export the definitions as JSON, import a file of them (checked as the project file checks them,
// an id the project already has gets a new one). Laid out as the wall types and the materials.

import type { App } from '../app/app';
import type { Doc } from '../app/document';
import { copyLibraryLink } from '../app/library-link';
import { newId } from '../core/id';
import { addDefinition, definitionDeleteBlocker, deleteDefinition } from '../elements/object/commands';
import { evaluateObject, pieceOutline } from '../elements/object/evaluate';
import { words } from '../elements/object/fields';
import { DEFINITION_PREFIX, type ObjectDefinition } from '../elements/object/schema';
import { libraryOf, mergeLibrary } from '../io/library-file';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { editDefinition } from './definition-editor';
import { getLang, type MessageKey, t } from './i18n';
import { icon } from './icons';

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
  const rings = [...ev.pieces].sort((a, b) => a.z + a.h - (b.z + b.h)).map((p) => ({ ring: pieceOutline(p), color: /^#[0-9a-f]{3,8}$/i.test(p.material.color) ? p.material.color : 'none' }));
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

export function showObjects(app: App, first?: string): void {
  let chosen = first ?? app.store.get().definitions[0]?.id ?? '';
  let query = '';
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void importLibrary(app, file).then((said) => app.toast(said));
  });
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    // The folders in order, each with its objects by name, those the search leaves.
    const folders = new Map<string, ObjectDefinition[]>();
    for (const d of doc.definitions.filter((x) => answers(x, query))) folders.set(folderOf(d), [...(folders.get(folderOf(d)) ?? []), d]);
    const lang = getLang() === 'pt' ? 'pt-BR' : 'en';
    const shown = [...folders.keys()].sort((a, b) => a.localeCompare(b, lang)).map((name) => ({ name, defs: folders.get(name)!.sort((a, b) => words(a.name).localeCompare(words(b.name), lang)) }));
    // The chosen one is one the list shows: the first when the search hides it.
    const visible = shown.flatMap((f) => f.defs);
    if (!visible.some((d) => d.id === chosen)) chosen = visible[0]?.id ?? '';
    const def = visible.find((d) => d.id === chosen);
    const placed = (id: string) => doc.objects.filter((o) => o.definitionId === id).length;
    const list = el('div', { class: 'types-list', role: 'group', 'aria-label': t('objs.list') });
    // The search: by name or folder, as it is typed.
    const search = el('input', { type: 'search', class: 'keys-search', placeholder: t('objs.search'), 'aria-label': t('objs.search') });
    search.value = query;
    search.dataset.focus = 'search';
    search.addEventListener('input', () => {
      query = search.value;
      dialog.redraw();
    });
    list.append(search);
    for (const { name, defs } of shown) {
      list.append(el('div', { class: 'objs-folder' }, name));
      for (const d of defs) {
        const b = el('button', { type: 'button', class: 'types-item', 'aria-pressed': String(d.id === chosen) });
        b.dataset.focus = `def:${d.id}`;
        const thumb = el('span', { class: 'objs-thumb' });
        thumb.innerHTML = thumbnailSvg(d, doc) ?? icon('box', 18);
        b.append(thumb);
        const n = placed(d.id);
        b.append(el('span', { class: 'types-name' }, words(d.name)), el('span', { class: 'types-count' }, n === 0 ? t('objs.none') : n === 1 ? t('objs.placedOne') : t('objs.placed', { n })));
        b.addEventListener('click', () => {
          chosen = d.id;
          dialog.redraw();
        });
        list.append(b);
      }
    }
    if (shown.length === 0) list.append(el('p', { class: 'mat-note' }, t('objs.noMatch')));
    const detail = el('div', { class: 'types-detail mat-detail' });
    if (def) {
      detail.append(
        el('h3', {}, words(def.name)),
        el('p', { class: 'mat-note' }, t('objs.summary', { p: def.params.length, k: def.parts.length, h: def.handles.length, t: def.types.length })),
        el('p', { class: 'mat-note' }, def.types.map((x) => words(x.name)).join(' · ')),
        el('p', { class: 'mat-note' }, t('objs.inFolder', { folder: folderOf(def) })),
      );
    }
    const btn = (label: string, focus: string, run: () => void, primary = false) => {
      const b = el('button', { type: 'button', class: primary ? 'icon-btn text-btn primary' : 'icon-btn text-btn' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    // Editing opens the editor in this dialog's place; it comes back here when closed.
    const edit = btn(t('objs.edit'), 'edit', () => def && (close(), editDefinition(app, def, false, () => showObjects(app, def.id))));
    edit.toggleAttribute('disabled', !def);
    // Placing it: the ribbon shows only some of the library (app/ribbon-tabs.ts), this places any.
    const place = btn(t('objs.place'), 'place', () => def && (close(), app.placeObject(def.id)), true);
    place.toggleAttribute('disabled', !def);
    const add = btn(t('objs.new'), 'new', () => {
      const fresh = blankDefinition(doc.definitions.length + 1);
      close();
      editDefinition(app, fresh, true, () => showObjects(app, fresh.id));
    });
    const dup = btn(t('objs.duplicate'), 'duplicate', () => {
      if (!def) return;
      const copy: ObjectDefinition = { ...def, id: newId(DEFINITION_PREFIX), name: { pt: `${def.name.pt} (2)`, en: `${def.name.en} (2)` } };
      chosen = copy.id;
      app.store.dispatch(addDefinition(copy));
    });
    const del = el('button', { type: 'button', class: 'icon-btn' });
    del.innerHTML = icon('trash', 16);
    del.dataset.focus = 'delete';
    const blocker = def ? definitionDeleteBlocker(doc, def.id) : null;
    const action = t('objs.deleteNamed', { name: def ? words(def.name) : '' });
    const why = blocker === 'inUse' ? t('objs.cantDeleteInUse') : blocker === 'nested' ? t('objs.cantDeleteNested') : null;
    del.disabled = !def || why !== null;
    del.setAttribute('aria-label', action);
    del.title = why ? `${action}: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : action;
    del.addEventListener('click', () => def && app.store.dispatch(deleteDefinition(def.id)));
    // The file: every definition with the materials they use (io/library-file.ts).
    const exportBtn = btn(t('objs.export'), 'export', () => {
      const text = JSON.stringify(libraryOf(app.store.get(), null), null, 2);
      app.download(`${app.fileBase()}-objetos.json`, new Blob([text], { type: 'application/json' }), 'application/json');
    });
    const importBtn = btn(t('objs.import'), 'import', () => fileInput.click());
    // The chosen one by link: with what it nests and the materials it uses.
    const linkBtn = btn(t('lib.copyLink'), 'link', () => def && void copyLibraryLink(app, libraryOf(app.store.get(), [def.id])));
    linkBtn.disabled = !def;
    return el(
      'div',
      { class: 'dialog dialog-wide types-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('objs.title') },
      el('h2', {}, t('objs.title')),
      el('div', { class: 'types-body' }, list, detail),
      el('div', { class: 'actions' }, add, dup, del, exportBtn, importBtn, linkBtn, fileInput, el('span', { class: 'spacer' }), edit, place, btn(t('help.close'), 'close', close)),
    );
  };
  const dialog = openProjectDialog(app, render, () => `def:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="def:${chosen}"]`)?.focus();
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
  return t('lib.imported', { defs: r.definitions, mats: r.materials, bad: r.bad });
}
