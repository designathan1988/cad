// Reusable controls, one place for all panels: number field with unit, segmented choice, select,
// collapsible section. They only read values and report changes.

import { parseLength } from '../core/measure';
import { icon, type IconName } from './icons';
import { num, t } from './i18n';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

export function section(title: string, open: boolean, ...rows: HTMLElement[]): HTMLDetailsElement {
  const d = el('details', { class: 'section' });
  d.open = open;
  const s = el('summary');
  s.innerHTML = icon('chevronRight', 14);
  s.append(title);
  d.append(s, el('div', { class: 'rows' }, ...rows.flatMap((r) => [...r.childNodes] as HTMLElement[])));
  return d;
}

/** A label + control pair, unwrapped into the section's two-column grid. */
export function row(label: string, control: HTMLElement, opts: { sub?: boolean; id?: string } = {}): HTMLElement {
  const id = opts.id ?? `f_${Math.random().toString(36).slice(2, 8)}`;
  const l = el('label', { for: id, class: opts.sub ? 'sub' : '' }, label);
  const focusable = control.querySelector('input, select, button') ?? control;
  focusable.id = id;
  const wrap = el('div');
  wrap.append(l, control);
  return wrap;
}

/**
 * Number field in metres. Typing accepts expressions and units; Enter or leaving applies, Esc
 * restores. Dragging on the row's label scrubs the value in 1 cm steps. `value` null shows "various".
 */
export function numberField(value: number | null, onCommit: (v: number) => void, min = -Infinity): HTMLElement {
  const box = el('div', { class: 'num-field' });
  const input = el('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false' });
  const shown = () => (value === null ? '' : num(value));
  input.value = shown();
  input.placeholder = value === null ? t('panel.varies') : '';
  const commit = () => {
    if (input.value.trim() === '' || input.value === shown()) {
      input.value = shown();
      return;
    }
    const r = parseLength(input.value);
    if (!r.ok || r.value < min) {
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.classList.remove('invalid');
    onCommit(r.value);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commit();
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = shown();
      input.classList.remove('invalid');
      input.blur();
    }
  });
  input.addEventListener('blur', commit);
  input.addEventListener('input', () => input.classList.remove('invalid'));
  box.append(input, el('span', { class: 'unit' }, 'm'));
  return box;
}

/** Makes a label scrub a number: horizontal drag, 1 cm per pixel, one change on release. */
export function scrub(label: HTMLElement, get: () => number | null, onCommit: (v: number) => void, min = -Infinity): void {
  label.classList.add('scrub');
  label.addEventListener('pointerdown', (e) => {
    const start = get();
    if (start === null || e.button !== 0) return;
    const x0 = e.clientX;
    const input = document.getElementById(label.getAttribute('for') ?? '') as HTMLInputElement | null;
    let v = start;
    label.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      v = Math.max(min, Math.round((start + (ev.clientX - x0) * 0.01) * 100) / 100);
      if (input) input.value = num(v);
    };
    const up = () => {
      label.removeEventListener('pointermove', move);
      label.removeEventListener('pointerup', up);
      if (v !== start) onCommit(v);
    };
    label.addEventListener('pointermove', move);
    label.addEventListener('pointerup', up);
  });
}

export function segmented<T extends string>(
  options: readonly { value: T; label: string; icon?: IconName }[],
  value: T | null,
  onChange: (v: T) => void,
  labelled = false,
): HTMLElement {
  const box = el('div', { class: 'segmented', role: 'group' });
  for (const o of options) {
    const b = el('button', { type: 'button', title: o.label, 'aria-label': o.label, 'aria-pressed': String(o.value === value) });
    b.innerHTML = o.icon ? icon(o.icon, 16) : '';
    if (!o.icon || labelled) b.append(el('span', { class: 'label' }, o.label));
    b.addEventListener('click', () => onChange(o.value));
    box.append(b);
  }
  return box;
}

export function select<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | null,
  onChange: (v: T) => void,
): HTMLElement {
  const box = el('div', { class: 'select' });
  const s = el('select');
  if (value === null) s.append(el('option', { value: '', disabled: '', selected: '' }, t('panel.varies')));
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.selected = true;
    s.append(opt);
  }
  // The whole label on hover, for any that the field is too narrow to show.
  s.title = options.find((o) => o.value === value)?.label ?? '';
  s.addEventListener('change', () => onChange(s.value as T));
  s.addEventListener('keydown', (e) => e.stopPropagation());
  box.append(s);
  box.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
  return box;
}
