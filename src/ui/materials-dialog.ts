// The materials dialog (docs/plano-de-escopo.md, phase 2): the project's materials, and the chosen one's
// name, colour, finish and cut pattern. New, duplicate and delete (not one wall layers are made of, nor
// the last). Every change is one command, and every layer made of the material follows at once, in plan
// and in 3D. Laid out as the wall types dialog: the list on the left, the chosen one beside it.

import type { App } from '../app/app';
import { newId } from '../core/id';
import { addMaterial, deleteMaterial, materialDeleteBlocker, materialUses, type MaterialPatch, updateMaterial } from '../elements/material/commands';
import { CUT_PATTERNS, type CutPattern, type MaterialId } from '../elements/material/schema';
import { el, numberField, select } from './controls';
import { openProjectDialog } from './dialog';
import { textField } from './fields';
import { materialLabel, t, type MessageKey } from './i18n';
import { icon } from './icons';

export function showMaterials(app: App, first?: MaterialId): void {
  let chosen = first ?? app.store.get().materials[0]?.id ?? '';
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    if (!doc.materials.some((m) => m.id === chosen)) chosen = doc.materials[0]?.id ?? '';
    const mat = doc.materials.find((m) => m.id === chosen);
    const uses = (id: MaterialId) => materialUses(doc, id);
    const usedText = (n: number) => (n === 0 ? t('mats.unused') : n === 1 ? t('mats.usedByOne') : t('mats.usedBy', { n }));

    const list = el('div', { class: 'types-list', role: 'group', 'aria-label': t('mats.list') });
    for (const m of doc.materials) {
      const b = el('button', { type: 'button', class: 'types-item', 'aria-pressed': String(m.id === chosen) });
      b.dataset.focus = `mat:${m.id}`;
      b.append(el('span', { class: 'mat-chip', 'aria-hidden': 'true', style: `background:${m.color}` }));
      b.append(el('span', { class: 'types-name' }, materialLabel(m)), el('span', { class: 'types-count' }, usedText(uses(m.id))));
      b.addEventListener('click', () => {
        chosen = m.id;
        dialog.redraw();
      });
      list.append(b);
    }

    // A change redraws the dialog by itself (openProjectDialog), once the focus has landed.
    const update = (patch: MaterialPatch) => {
      if (mat) app.store.dispatch(updateMaterial(mat.id, patch));
    };
    const row = (label: string, control: HTMLElement, focus: string) => {
      const target = control.querySelector('input, select') ?? control;
      (target as HTMLElement).dataset.focus = focus;
      target.setAttribute('aria-label', label);
      return el('label', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, label), control);
    };
    const detail = el('div', { class: 'types-detail mat-detail' });
    if (mat) {
      // A built-in material shows its name in the interface's language until it is given one.
      const name = textField(materialLabel(mat), (v) => v.trim() !== '' && v.trim() !== materialLabel(mat) && update({ name: v }));
      // The colour picker reports while it is dragged: one command when it is closed (change), not one per step.
      const color = el('input', { type: 'color', class: 'mat-color' });
      color.value = mat.color;
      color.addEventListener('change', () => update({ color: color.value }));
      // From 0 to 1: a value outside is refused in the field, with what it takes, as a length below its least.
      const rough = numberField(mat.roughness, (v) => update({ roughness: v }), 0, 2, '', 1);
      const metal = numberField(mat.metalness, (v) => update({ metalness: v }), 0, 2, '', 1);
      const cut = select(
        CUT_PATTERNS.map((c) => ({ value: c, label: t(`cut.${c}` as MessageKey) })),
        mat.cut,
        (v: CutPattern) => update({ cut: v }),
      );
      detail.append(
        el('h3', {}, materialLabel(mat)),
        row(t('mats.name'), name, 'name'),
        row(t('mats.color'), color, 'color'),
        row(t('mats.roughness'), rough, 'roughness'),
        row(t('mats.metalness'), metal, 'metalness'),
        row(t('mats.cut'), cut, 'cut'),
        el('p', { class: 'mat-note' }, t('mats.note')),
      );
    }

    const btn = (label: string, focus: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
      b.dataset.focus = focus;
      b.addEventListener('click', run);
      return b;
    };
    // The new one is the chosen one before the command runs: the dialog redraws on it at once.
    const add = btn(t('mats.new'), 'new', () => {
      const id = newId('mat');
      chosen = id;
      app.store.dispatch(addMaterial({ id, name: t('mats.newName', { n: doc.materials.length + 1 }), color: '#b4b0a8', roughness: 0.9, metalness: 0, cut: 'solid' }));
    });
    const dup = btn(t('mats.duplicate'), 'duplicate', () => {
      if (!mat) return;
      const id = newId('mat');
      chosen = id;
      app.store.dispatch(addMaterial({ ...mat, id, name: `${materialLabel(mat)} (2)` }));
    });
    dup.disabled = !mat;
    const del = el('button', { type: 'button', class: 'icon-btn' });
    del.innerHTML = icon('trash', 16);
    del.dataset.focus = 'delete';
    const blocker = mat ? materialDeleteBlocker(doc, mat.id) : 'missing';
    const action = t('mats.deleteNamed', { name: mat ? materialLabel(mat) : '' });
    const why = blocker === 'inUse' ? t('mats.cantDeleteInUse') : blocker === 'last' ? t('mats.cantDeleteLast') : null;
    del.disabled = blocker !== null;
    del.setAttribute('aria-label', action);
    // What it does, then why it cannot.
    del.title = why ? `${action}: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : action;
    const whyNode = why ? el('span', { id: 'mats-why', class: 'sr-only' }, why) : null;
    if (whyNode) del.setAttribute('aria-describedby', 'mats-why');
    del.addEventListener('click', () => mat && app.store.dispatch(deleteMaterial(mat.id)));

    return el(
      'div',
      { class: 'dialog dialog-wide types-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('mats.title') },
      el('h2', {}, t('mats.title')),
      el('div', { class: 'types-body' }, list, detail),
      el('div', { class: 'actions' }, add, dup, del, ...(whyNode ? [whyNode] : []), el('span', { class: 'spacer' }), btn(t('help.close'), 'close', close)),
    );
  };

  // Where the focus goes when its control is gone or disabled (a material deleted): the chosen one.
  const dialog = openProjectDialog(app, render, () => `mat:${chosen}`);
  app.shell.helpBack.querySelector<HTMLElement>(`[data-focus="mat:${chosen}"]`)?.focus();
}
