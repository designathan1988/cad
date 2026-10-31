// The object editor (phase 4: no code): a definition edited as a draft, then saved in one undo step
// (every object of it follows), or dropped. Its name and category; tabs for its parameters, parts,
// handles, types and rules, each a table of fields; numbers and formulas typed as in the formulas
// (elements/object/formula.ts: 60cm, largura/2, if(fundo, 1, 0)), the names of the parameters offered
// as one types. Beside them a live 3D preview turned by dragging, sliders that flex each parameter (the
// Revit test: does it still hold?), and what does not work out.

import type { App } from '../session/app';
import { addDefinition, updateDefinition } from '../elements/object/commands';
import { evaluateObject } from '../elements/object/evaluate';
import { words } from '../elements/object/fields';
import type { DefinitionCategory, ObjectDefinition } from '../elements/object/schema';
import { isDefinition } from '../elements/object/valid';
import { el } from './controls';
import { type MessageKey, t } from '../i18n/messages';
import { Preview } from './definition-preview';
import { editorKit } from './definition-kit';
import { editorTabs, withoutKey } from './definition-tabs';
import { standInObjectId } from '../elements/object/schema';

export type Tab = 'params' | 'parts' | 'handles' | 'types' | 'rules';
const TABS: readonly Tab[] = ['params', 'parts', 'handles', 'types', 'rules'];
const CATEGORIES: readonly DefinitionCategory[] = ['furniture', 'casework', 'fixture', 'equipment', 'lighting', 'plant', 'generic'];
const NAME = /^[A-Za-z_À-ÿ][\wÀ-ÿ]*$/;

/** The state of one editDefinition run, with one owner (was loose lets of the function). */
export interface EditorState {
  draft: ObjectDefinition;
  tab: Tab;
  /** The sliders' values (flexing, not saved), and the preview's turn and tilt. */
  flex: Record<string, number>;
  yaw: number;
  pitch: number;
  preview: Preview | null;
}

export function editDefinition(app: App, start: ObjectDefinition, isNew: boolean, done: () => void): void {
  const back = app.shell.helpBack;
  const ed: EditorState = {
    draft: structuredClone(start) as ObjectDefinition,
    tab: 'params',
    flex: {},
    yaw: -0.6,
    pitch: 0.45,
    preview: null,
  };

  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    ed.preview?.dispose();
    back.hidden = true;
    back.replaceChildren();
    done();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  const set = (next: ObjectDefinition) => {
    ed.draft = next;
    draw();
  };

  /** What does not work out in the draft: names, then the evaluation's problems, then its rules. */
  const problems = (): string[] => {
    const out: string[] = [];
    const names = ed.draft.params.map((p) => p.name);
    for (const p of ed.draft.params) if (!NAME.test(p.name)) out.push(t('ed.badName', { name: p.name || '—' }));
    for (const n of new Set(names)) if (names.filter((x) => x === n).length > 1) out.push(t('ed.twice', { name: n }));
    if (ed.draft.types.length === 0) out.push(t('ed.noType'));
    const doc = app.store.get();
    const ev = evaluateObject(ed.draft, previewInstance(), { definitions: [...doc.definitions.filter((d) => d.id !== ed.draft.id), ed.draft], materials: doc.materials });
    out.push(...ev.problems, ...ev.warnings.map(words));
    return out;
  };
  const previewInstance = () => ({ id: standInObjectId('object_editor'), levelId: '', definitionId: ed.draft.id, typeId: ed.draft.types[0]?.id ?? '', at: { x: 0, y: 0 }, angle: 0, elevation: 0, values: ed.flex });

  const kit = editorKit(app, ed);
  const { input, choose } = kit;
  const { paramsTab, partsTab, handlesTab, typesTab, rulesTab } = editorTabs(app, { ed, kit, set, draw: () => draw() });

  // ---------- the dialog ----------
  const draw = () => {
    const a = document.activeElement;
    const key = a instanceof HTMLElement && back.contains(a) ? a.dataset.focus : undefined;
    const names = el('datalist', { id: 'ed-names' }, ...ed.draft.params.map((p) => new Option(p.name)));
    const tabs = el('div', { class: 'segmented ed-tabs', role: 'tablist' });
    for (const x of TABS) {
      const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(x === ed.tab), 'aria-pressed': String(x === ed.tab) }, t(`ed.tab.${x}` as MessageKey));
      b.dataset.focus = `tab:${x}`;
      b.addEventListener('click', () => {
        ed.tab = x;
        draw();
      });
      tabs.append(b);
    }
    const body = el('div', { class: 'ed-body' }, ...(ed.tab === 'params' ? paramsTab() : ed.tab === 'parts' ? partsTab() : ed.tab === 'handles' ? handlesTab() : ed.tab === 'types' ? typesTab() : rulesTab()));
    // The preview: the draft with the sliders' values, turned by dragging. One for the whole edit (a
    // browser keeps few WebGL contexts): its canvas moves into each drawing of the dialog.
    const canvas = ed.preview?.canvasEl ?? el('canvas', { class: 'ed-preview', 'aria-label': t('ed.preview') });
    const sliders = el('div', { class: 'ed-sliders', role: 'group', 'aria-label': t('ed.flex') });
    const doc = app.store.get();
    const evNow = evaluateObject(ed.draft, previewInstance(), { definitions: [...doc.definitions.filter((d) => d.id !== ed.draft.id), ed.draft], materials: doc.materials });
    for (const p of ed.draft.params) {
      if (p.formula !== undefined || p.kind === 'material' || p.kind === 'choice') continue;
      const v = evNow.env[p.name] ?? 0;
      const lo = p.min ?? Math.min(0, v);
      const hi = p.max ?? Math.max(1, v * 2);
      const r = el('input', { type: 'range', min: String(lo), max: String(hi), step: String(p.kind === 'integer' || p.kind === 'bool' ? 1 : (hi - lo) / 200), 'aria-label': words(p.label) });
      r.value = String(v);
      r.dataset.focus = `flex:${p.name}`;
      r.addEventListener('input', () => {
        ed.flex = { ...ed.flex, [p.name]: Number(r.value) };
        ed.preview?.update(ed.draft, ed.flex);
      });
      r.addEventListener('change', () => draw());
      sliders.append(el('label', { class: 'ed-slider' }, el('span', {}, words(p.label)), r));
    }
    const said = problems();
    const status = el('div', { class: said.length ? 'ed-problems' : 'ed-ok', role: 'status' }, said.length ? said.join(' · ') : t('ed.allGood'));
    const nameRow = el(
      'div',
      { class: 'ed-name' },
      el('label', { class: 'ed-cell' }, el('span', {}, `${t('ed.name')} (pt)`), input(ed.draft.name.pt, (v) => set({ ...ed.draft, name: { ...ed.draft.name, pt: v.trim() || ed.draft.name.pt } }), 'name:pt', `${t('ed.name')} (pt)`)),
      el('label', { class: 'ed-cell' }, el('span', {}, `${t('ed.name')} (en)`), input(ed.draft.name.en, (v) => set({ ...ed.draft, name: { ...ed.draft.name, en: v.trim() || ed.draft.name.en } }), 'name:en', `${t('ed.name')} (en)`)),
      el('label', { class: 'ed-cell' }, el('span', {}, t('ed.category')), choose(CATEGORIES.map((c) => ({ value: c, label: t(`ed.cat.${c}` as MessageKey) })), ed.draft.category, (v) => set({ ...ed.draft, category: v }), 'category', t('ed.category'))),
      // Its folder in the library: any name, the project's others offered; empty, its category's.
      el(
        'label',
        { class: 'ed-cell' },
        el('span', {}, t('ed.folder')),
        input(ed.draft.folder ?? '', (v) => set(v.trim() === '' ? withoutKey(ed.draft, 'folder') : { ...ed.draft, folder: v.trim() }), 'folder', t('ed.folder'), 'ed-folders'),
        el('datalist', { id: 'ed-folders' }, ...[...new Set(doc.definitions.flatMap((d) => (d.folder ? [d.folder] : [])))].map((f) => new Option(f))),
      ),
    );
    const saveBtn = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('ed.save'));
    saveBtn.dataset.focus = 'save';
    const savable = isDefinition(ed.draft) && ed.draft.params.every((p) => NAME.test(p.name)) && new Set(ed.draft.params.map((p) => p.name)).size === ed.draft.params.length;
    saveBtn.toggleAttribute('disabled', !savable);
    saveBtn.addEventListener('click', () => {
      app.store.dispatch(isNew ? addDefinition(ed.draft) : updateDefinition(ed.draft));
      isNew = false;
      close();
    });
    const cancel = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('ed.cancel'));
    cancel.dataset.focus = 'cancel';
    cancel.addEventListener('click', close);
    back.replaceChildren(
      el(
        'div',
        { class: 'dialog dialog-xl ed-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ed.title', { name: words(ed.draft.name) }) },
        el('h2', {}, t('ed.title', { name: words(ed.draft.name) })),
        nameRow,
        el('div', { class: 'ed-main' }, el('div', { class: 'ed-left' }, tabs, body, names), el('div', { class: 'ed-right' }, canvas, sliders, status)),
        el('div', { class: 'actions' }, el('span', { class: 'spacer' }), cancel, saveBtn),
      ),
    );
    back.hidden = false;
    ed.preview ??= new Preview(canvas, () => [ed.yaw, ed.pitch], (y, p) => {
      ed.yaw = y;
      ed.pitch = p;
    }, app, previewInstance);
    ed.preview.update(ed.draft, ed.flex);
    const target = (key && back.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`)) || back.querySelector<HTMLElement>(`[data-focus="tab:${ed.tab}"]`);
    target?.focus();
  };

  window.addEventListener('keydown', onKey, true);
  draw();
}
