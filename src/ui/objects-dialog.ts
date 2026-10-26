// The project's objects (phase 4): its library of parametric definitions. Each with how many are placed;
// new, duplicate, edit (definition-editor.ts), delete (not one placed or nested in another), and library
// files: export the definitions as JSON, import a file of them (checked as the project file checks them,
// an id the project already has gets a new one). Laid out as the wall types and the materials.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { addDefinition, definitionDeleteBlocker, deleteDefinition } from '../elements/object/commands';
import { words } from '../elements/object/fields';
import { DEFINITION_PREFIX, type ObjectDefinition } from '../elements/object/schema';
import { isDefinition } from '../elements/object/valid';
import { el } from './controls';
import { openProjectDialog } from './dialog';
import { editDefinition } from './definition-editor';
import { t } from './i18n';
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

export function showObjects(app: App, first?: string): void {
  let chosen = first ?? app.store.get().definitions[0]?.id ?? '';
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', hidden: '' });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void importLibrary(app, file).then((said) => app.toast(said));
  });
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    if (!doc.definitions.some((d) => d.id === chosen)) chosen = doc.definitions[0]?.id ?? '';
    const def = doc.definitions.find((d) => d.id === chosen);
    const placed = (id: string) => doc.objects.filter((o) => o.definitionId === id).length;
    const list = el('div', { class: 'types-list', role: 'group', 'aria-label': t('objs.list') });
    for (const d of doc.definitions) {
      const b = el('button', { type: 'button', class: 'types-item', 'aria-pressed': String(d.id === chosen) });
      b.dataset.focus = `def:${d.id}`;
      b.insertAdjacentHTML('beforeend', icon('box', 18));
      const n = placed(d.id);
      b.append(el('span', { class: 'types-name' }, words(d.name)), el('span', { class: 'types-count' }, n === 0 ? t('objs.none') : t('objs.placed', { n })));
      b.addEventListener('click', () => {
        chosen = d.id;
        dialog.redraw();
      });
      list.append(b);
    }
    const detail = el('div', { class: 'types-detail mat-detail' });
    if (def) {
      detail.append(
        el('h3', {}, words(def.name)),
        el('p', { class: 'mat-note' }, t('objs.summary', { p: def.params.length, k: def.parts.length, h: def.handles.length, t: def.types.length })),
        el('p', { class: 'mat-note' }, def.types.map((x) => words(x.name)).join(' · ')),
      );
    }
    const btn = (label: string, focus: string, run: () => void, primary = false) => {
      const b = el('button', { type: 'button', class: primary ? 'icon-btn text-btn primary' : 'icon-btn text-btn' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    // Editing opens the editor in this dialog's place; it comes back here when closed.
    const edit = btn(t('objs.edit'), 'edit', () => def && (close(), editDefinition(app, def, false, () => showObjects(app, def.id))), true);
    edit.toggleAttribute('disabled', !def);
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
    const exportBtn = btn(t('objs.export'), 'export', () => {
      const text = JSON.stringify({ cad2Library: 1, definitions: app.store.get().definitions }, null, 2);
      app.download(`${app.fileBase()}-objetos.json`, new Blob([text], { type: 'application/json' }), 'application/json');
    });
    const importBtn = btn(t('objs.import'), 'import', () => fileInput.click());
    return el(
      'div',
      { class: 'dialog dialog-wide types-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('objs.title') },
      el('h2', {}, t('objs.title')),
      el('div', { class: 'types-body' }, list, detail),
      el('div', { class: 'actions' }, add, dup, del, exportBtn, importBtn, fileInput, el('span', { class: 'spacer' }), edit, btn(t('help.close'), 'close', close)),
    );
  };
  const dialog = openProjectDialog(app, render, () => `def:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="def:${chosen}"]`)?.focus();
}

/** A library file read into the project: its valid definitions added (new ids where taken), and what was done. */
async function importLibrary(app: App, file: File): Promise<string> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (e) {
    return t('objs.importBad', { error: e instanceof Error ? e.message : String(e) });
  }
  const list = Array.isArray(raw) ? raw : (raw as { definitions?: unknown })?.definitions;
  if (!Array.isArray(list)) return t('objs.importBad', { error: t('objs.importNoList') });
  const doc = app.store.get();
  const good = list.filter(isDefinition);
  const taken = new Set(doc.definitions.map((d) => d.id));
  // A definition whose id the project has gets a new one, and the definitions of the file that nest it follow.
  const renamed = new Map<string, string>();
  for (const d of good) {
    const id = taken.has(d.id) ? newId(DEFINITION_PREFIX) : d.id;
    taken.add(id);
    renamed.set(d.id, id);
  }
  const added = good.map((d): ObjectDefinition => ({
    ...d,
    id: renamed.get(d.id)!,
    parts: d.parts.map((p) => (p.kind === 'object' && renamed.has(p.definition) ? { ...p, definition: renamed.get(p.definition)! } : p)),
  }));
  // One undo step for the whole file.
  app.store.dispatch({ label: 'cmd.addDefinition', apply: (x) => added.reduce((acc, d) => addDefinition(d).apply(acc), x) });
  return t('objs.imported', { n: added.length, bad: list.length - good.length });
}
