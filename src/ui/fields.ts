// Panels generated from the elements' field schemas (ref/chat.txt:247): each element lists its
// fields (src/elements/*/fields.ts) and this one renderer builds the rows from the shared controls,
// so every panel looks and behaves alike. A field shows the value common to the selection, or
// "varies"; it can show only for some selections; it can be marked as the element's own value over
// its type's, with the way back.

import { el, numberField, row, scrub, searchSelect, section, segmented, select } from './controls';
import { t, type MessageKey } from '../i18n/messages';
import { icon, type IconName } from '../i18n/icons';

export { type Field, type FieldOption, type FieldState } from '../elements/fields';
import { type Field, type FieldState } from '../elements/fields';

/** Which fields show for the selection, each with the value common to it (pure). */
export function fieldStates<T>(fields: readonly Field<T>[], items: readonly T[]): FieldState<T>[] {
  if (items.length === 0) return [];
  return fields
    .filter((f) => !f.when || f.when(items))
    .map((field) => {
      if (field.kind === 'readout' || field.kind === 'note') return { field, value: field.text(items) };
      if (field.kind === 'action') return { field, value: field.enabled === undefined || field.enabled(items) ? 'enabled' : 'disabled' };
      const first = JSON.stringify(field.get(items[0]!));
      const same = items.every((x) => JSON.stringify(field.get(x)) === first);
      return { field, value: same ? field.get(items[0]!) : null };
    });
}

/**
 * The icon each kind of field shows before its label, by its id, in every panel alike (a field may give
 * its own): a CAD inspector reads by these as much as by the words.
 */
const FIELD_ICONS: Readonly<Record<string, IconName>> = {
  type: 'wall',
  kind: 'door',
  reference: 'refCenter',
  level: 'slab',
  baseOffset: 'raise',
  top: 'arrowUp',
  topOffset: 'lower',
  topHeight: 'height',
  heightNow: 'height',
  length: 'dimension',
  chord: 'dimension',
  radius: 'radius',
  thickness: 'wall',
  width: 'width',
  height: 'height',
  sill: 'raise',
  rule: 'ruler',
  distance: 'dimension',
  anchorDistance: 'dimension',
  gap: 'distribute',
  spacing: 'distribute',
  jambs: 'width',
  swing: 'swing',
  hinge: 'door',
  name: 'text',
  number: 'hash',
  area: 'room',
  perimeter: 'frame',
  use: 'tag',
  mark: 'tag',
  volume: 'cube',
  source: 'room',
  offset: 'raise',
  operation: 'swing',
  leaves: 'split',
  frame: 'frame',
  casing: 'frame',
  transom: 'window',
  screen: 'window',
  threshold: 'slab',
  openAmount: 'doorOpen',
  placeSwing: 'swing',
  placeHinge: 'door',
  design: 'door',
  handle: 'pointer',
  glazing: 'window',
  muntins: 'table',
  leafMaterial: 'door',
  frameMaterial: 'frame',
};

/** The label of a row: its icon, then its words. */
function labelled<T>(field: Field<T>): string | { text: string; icon: IconName } {
  const ic = field.icon ?? FIELD_ICONS[field.id];
  return ic ? { text: t(field.label, field.labelVars), icon: ic } : t(field.label, field.labelVars);
}

/** A section of rows for the selection, from the fields. */
export function fieldsSection<T>(title: string, open: boolean, fields: readonly Field<T>[], items: readonly T[]): HTMLElement {
  const states = fieldStates(fields, items);
  const noteId = `own-note-${Math.random().toString(36).slice(2, 8)}`;
  let anyOwn = false;
  let note: MessageKey = 'panel.overrideNote';
  const rows = states.map(({ field, value }) => {
    if (field.kind === 'note') return el('div', {}, el('div', { class: 'panel-note' }, String(value)));
    if (field.kind === 'action') {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn wide-btn' }, t(field.label, field.labelVars));
      b.disabled = value === 'disabled';
      b.addEventListener('click', field.run);
      return el('div', {}, b);
    }
    const control = controlFor(field, value, items);
    const own = field.own?.(items) === true;
    // Every number scrubs from its label, as Revit's and Figma's do: one rule for all panels.
    const scrubbing = (r: HTMLElement) => {
      const label = r.querySelector('label');
      if (field.kind === 'number' && label) scrub(label, () => value as number | null, field.set, minOf(field, items), field.unit ?? 'm');
      return r;
    };
    if (!own) return scrubbing(row(labelled(field), control, { sub: field.sub === true, wide: field.wide === true }));
    anyOwn = true;
    if (field.ownWords) note = field.ownWords.note;
    // The note is the field's description; the way back says which field it puts back.
    control.querySelector('input, select, button')?.setAttribute('aria-describedby', noteId);
    const what = t(field.label, field.labelVars);
    const resetText = t(field.ownWords?.reset ?? 'panel.resetToTypeOf', { field: what });
    const back = el('button', {
      type: 'button',
      class: 'icon-btn reset-type',
      title: resetText,
      'aria-label': resetText,
    });
    back.innerHTML = icon('undo', 14);
    back.addEventListener('click', () => field.reset?.());
    return scrubbing(row(labelled(field), el('div', { class: 'overridden' }, control, back), { sub: field.sub === true, mark: true }));
  });
  if (anyOwn) rows.push(el('div', {}, el('div', { class: 'panel-note', id: noteId }, t(note))));
  return section(title, open, ...rows);
}

/**
 * The fields as the ribbon's rows (a tool's tab: the next element's type and properties, prototype v7's
 * fields in the ribbon): its label, then its control, three to a column. What only reads or acts is the
 * panel's. Each row is marked by its field (data-rf), so the focus finds it again once drawn anew.
 */
export function ribbonFieldRows<T>(fields: readonly Field<T>[], items: readonly T[]): HTMLElement[] {
  return fieldStates(fields, items).flatMap(({ field, value }) => {
    if (field.kind === 'readout' || field.kind === 'note' || field.kind === 'action') return [];
    const label = el('span', { class: 'rb-field-label' });
    const ic = field.icon ?? FIELD_ICONS[field.id];
    if (ic) label.innerHTML = icon(ic, 14);
    label.append(el('span', {}, t(field.label, field.labelVars)));
    const control = controlFor(field, value, items);
    control.querySelector('input, select, button')?.setAttribute('aria-label', t(field.label, field.labelVars));
    if (field.kind === 'number') scrub(label, () => value as number | null, field.set, minOf(field, items), field.unit ?? 'm');
    const r = el('div', { class: `rb-field rb-field-${field.kind}` }, label, control);
    r.dataset.rf = field.id;
    return [r];
  });
}

const minOf = <T>(field: Extract<Field<T>, { kind: 'number' }>, items: readonly T[]): number =>
  typeof field.min === 'function' ? field.min(items) : (field.min ?? -Infinity);

function controlFor<T>(field: Field<T>, value: number | string | null, items: readonly T[]): HTMLElement {
  switch (field.kind) {
    case 'number':
      return numberField(value as number | null, field.set, minOf(field, items), field.decimals ?? 2, field.unit ?? 'm');
    case 'text':
      return textField(value as string | null, field.set, field.placeholder);
    case 'select':
      return select(field.options, value as string | null, field.set);
    case 'segmented':
      return segmented(field.options, value as string | null, field.set, field.labelled ?? field.options.every((o) => !o.icon));
    case 'search':
      return searchSelect(field.options, value as string | null, field.set, t(field.label, field.labelVars));
    case 'readout':
    case 'note':
    case 'action':
      return el('div', { class: 'readout' }, String(value ?? ''));
  }
}

/** A text field that commits on Enter or leaving, and restores on Esc. Null shows "varies". */
export function textField(value: string | null, onCommit: (v: string) => void, empty = ''): HTMLElement {
  const input = el('input', { type: 'text', class: 'text-field', autocomplete: 'off', spellcheck: 'false' });
  const shown = value ?? '';
  input.value = shown;
  input.placeholder = value === null ? t('panel.varies') : empty;
  const commit = () => {
    if (input.value !== shown) onCommit(input.value);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = shown;
      input.blur();
    }
  });
  input.addEventListener('blur', commit);
  return el('div', { class: 'num-field' }, input);
}
