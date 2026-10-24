// Panels generated from the elements' field schemas (ref/chat.txt:247): each element lists its
// fields (src/elements/*/fields.ts) and this one renderer builds the rows from the shared controls,
// so every panel looks and behaves alike. A field shows the value common to the selection, or
// "varies"; it can show only for some selections; it can be marked as the element's own value over
// its type's, with the way back.

import { el, numberField, row, scrub, searchSelect, section, segmented, select } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';

interface Common<T> {
  readonly id: string;
  readonly label: MessageKey;
  /** Indented under the field before it. */
  readonly sub?: boolean;
  /** Shown only for these selections (default: always). */
  readonly when?: (items: readonly T[]) => boolean;
  /** Some selected element sets this value over its type's; `reset` gives it back to the type. */
  readonly own?: (items: readonly T[]) => boolean;
  readonly reset?: () => void;
}

export type FieldOption = { readonly value: string; readonly label: string; readonly icon?: IconName; readonly thumb?: string; readonly keywords?: string };

export type Field<T> =
  /** `min`: the lowest value, or one that depends on what is selected (an arc's radius: half its chord). */
  | (Common<T> & { readonly kind: 'number'; readonly get: (x: T) => number; readonly set: (v: number) => void; readonly min?: number | ((items: readonly T[]) => number) })
  | (Common<T> & { readonly kind: 'text'; readonly get: (x: T) => string; readonly set: (v: string) => void })
  | (Common<T> & {
      readonly kind: 'select' | 'segmented' | 'search';
      readonly get: (x: T) => string;
      readonly set: (v: string) => void;
      readonly options: readonly FieldOption[];
      /** Segmented: the label beside each icon, not only as its name. */
      readonly labelled?: boolean;
    })
  | (Common<T> & { readonly kind: 'readout'; readonly text: (items: readonly T[]) => string })
  /** A note across the whole row. */
  | (Common<T> & { readonly kind: 'note'; readonly text: (items: readonly T[]) => string })
  /** A button across the whole row, named by what it does. */
  | (Common<T> & { readonly kind: 'action'; readonly run: () => void; readonly enabled?: (items: readonly T[]) => boolean });

export interface FieldState<T> {
  readonly field: Field<T>;
  /** The common value (a readout's text); null when the selected elements differ. */
  readonly value: number | string | null;
}

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

/** A section of rows for the selection, from the fields. */
export function fieldsSection<T>(title: string, open: boolean, fields: readonly Field<T>[], items: readonly T[]): HTMLElement {
  const states = fieldStates(fields, items);
  const noteId = `own-note-${Math.random().toString(36).slice(2, 8)}`;
  let anyOwn = false;
  const rows = states.map(({ field, value }) => {
    if (field.kind === 'note') return el('div', {}, el('div', { class: 'panel-note' }, String(value)));
    if (field.kind === 'action') {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn wide-btn' }, t(field.label));
      b.disabled = value === 'disabled';
      b.addEventListener('click', field.run);
      return el('div', {}, b);
    }
    const control = controlFor(field, value, items);
    const own = field.own?.(items) === true;
    // Every number scrubs from its label, as Revit's and Figma's do: one rule for all panels.
    const scrubbing = (r: HTMLElement) => {
      const label = r.querySelector('label');
      if (field.kind === 'number' && label) scrub(label, () => value as number | null, field.set, minOf(field, items));
      return r;
    };
    if (!own) return scrubbing(row(t(field.label), control, { sub: field.sub === true }));
    anyOwn = true;
    // The note is the field's description; the way back says which field it puts back.
    control.querySelector('input, select, button')?.setAttribute('aria-describedby', noteId);
    const what = t(field.label);
    const back = el('button', {
      type: 'button',
      class: 'icon-btn reset-type',
      title: t('panel.resetToTypeOf', { field: what }),
      'aria-label': t('panel.resetToTypeOf', { field: what }),
    });
    back.innerHTML = icon('undo', 14);
    back.addEventListener('click', () => field.reset?.());
    return scrubbing(row(what, el('div', { class: 'overridden' }, control, back), { sub: field.sub === true, mark: true }));
  });
  if (anyOwn) rows.push(el('div', {}, el('div', { class: 'panel-note', id: noteId }, t('panel.overrideNote'))));
  return section(title, open, ...rows);
}

const minOf = <T>(field: Extract<Field<T>, { kind: 'number' }>, items: readonly T[]): number =>
  typeof field.min === 'function' ? field.min(items) : (field.min ?? -Infinity);

function controlFor<T>(field: Field<T>, value: number | string | null, items: readonly T[]): HTMLElement {
  switch (field.kind) {
    case 'number':
      return numberField(value as number | null, field.set, minOf(field, items));
    case 'text':
      return textField(value as string | null, field.set);
    case 'select':
      return select(field.options, value as string | null, field.set);
    case 'segmented':
      return segmented(field.options, value as string | null, field.set, field.labelled ?? field.options.every((o) => !o.icon));
    case 'search':
      return searchSelect(field.options, value as string | null, field.set, t(field.label));
    case 'readout':
    case 'note':
    case 'action':
      return el('div', { class: 'readout' }, String(value ?? ''));
  }
}

/** A text field that commits on Enter or leaving, and restores on Esc. Null shows "varies". */
export function textField(value: string | null, onCommit: (v: string) => void): HTMLElement {
  const input = el('input', { type: 'text', class: 'text-field', autocomplete: 'off', spellcheck: 'false' });
  const shown = value ?? '';
  input.value = shown;
  input.placeholder = value === null ? t('panel.varies') : '';
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
