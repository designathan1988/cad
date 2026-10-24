// Reusable controls, one place for all panels: number field with unit, segmented choice, select,
// collapsible section. They only read values and report changes.

import { parseLength } from '../core/measure';
import { icon, type IconName } from './icons';
import { num, t } from './i18n';
import { searchEntries } from './search';

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
/** `mark`: the value is the element's own, over its type's: a dot after the label, for the eye only. */
export function row(label: string, control: HTMLElement, opts: { sub?: boolean; id?: string; mark?: boolean } = {}): HTMLElement {
  const id = opts.id ?? `f_${Math.random().toString(36).slice(2, 8)}`;
  const l = el('label', { for: id, class: opts.sub ? 'sub' : '' }, label);
  if (opts.mark) l.append(el('span', { class: 'own-mark', 'aria-hidden': 'true' }, ' •'));
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

/**
 * A choice among many, with a search field and a thumbnail per option (ref/chat.txt:213): a button
 * showing the current one opens a list under it. The field is an APG combobox, as in the command
 * palette: arrows move, Enter picks, Esc closes and gives the focus back to the button.
 */
export function searchSelect<T extends string>(
  options: readonly { value: T; label: string; keywords?: string; thumb?: string }[],
  value: T | null,
  onChange: (v: T) => void,
  label: string,
): HTMLElement {
  const current = options.find((o) => o.value === value);
  const button = el('button', {
    type: 'button',
    class: 'search-select',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-label': `${label}: ${current?.label ?? t('panel.varies')}`,
    // Found again after a choice rebuilds the panel, to take the focus back (as Esc does).
    'data-focus-key': `search-select:${label}`,
  });
  button.innerHTML = current?.thumb ?? '';
  button.append(el('span', { class: 'search-select-label' }, current?.label ?? t('panel.varies')));
  button.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
  button.addEventListener('click', () => openList());

  function openList(): void {
    const r = button.getBoundingClientRect();
    const pop = el('div', { class: 'search-pop', role: 'dialog', 'aria-label': label });
    const id = `ss-${Math.random().toString(36).slice(2, 8)}`;
    const input = el('input', {
      type: 'text',
      class: 'search-pop-input',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': id,
      'aria-autocomplete': 'list',
      'aria-label': label,
      placeholder: t('search.placeholder'),
      autocomplete: 'off',
      spellcheck: 'false',
    });
    const list = el('ul', { class: 'search-pop-list', role: 'listbox', id, 'aria-label': label });
    pop.append(input, list);
    let shown: typeof options = [];
    let active = 0;
    const setActive = (i: number) => {
      active = i;
      [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      const li = list.children[i] as HTMLElement | undefined;
      if (li) {
        input.setAttribute('aria-activedescendant', li.id);
        li.scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    };
    const pick = (o: (typeof options)[number] | undefined) => {
      if (!o) return;
      close();
      if (o.value === value) return;
      onChange(o.value);
      // The change rebuilt the panel: the focus goes to the new button for the same field.
      document.querySelector<HTMLElement>(`[data-focus-key="search-select:${CSS.escape(label)}"]`)?.focus();
    };
    const update = () => {
      shown = searchEntries(options, input.value);
      list.replaceChildren(
        ...shown.map((o, i) => {
          const li = el('li', { id: `${id}-${i}`, role: 'option', class: 'search-pop-option', 'aria-selected': 'false' });
          li.innerHTML = o.thumb ?? '';
          li.append(el('span', {}, o.label));
          if (o.value === value) li.classList.add('current');
          li.addEventListener('pointermove', () => active !== i && setActive(i));
          li.addEventListener('click', () => pick(o));
          return li;
        }),
      );
      const at = shown.findIndex((o) => o.value === value);
      setActive(shown.length === 0 ? -1 : Math.max(0, at));
    };
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const n = shown.length;
      if (e.key === 'ArrowDown' && n > 0) setActive((active + 1) % n);
      else if (e.key === 'ArrowUp' && n > 0) setActive((active - 1 + n) % n);
      else if (e.key === 'Enter') pick(shown[active]);
      else if (e.key === 'Escape' || e.key === 'Tab') close();
      else return;
      e.preventDefault();
    });
    const outside = (e: PointerEvent) => {
      if (!pop.contains(e.target as Node) && e.target !== button) close();
    };
    function close(): void {
      window.removeEventListener('pointerdown', outside, true);
      pop.remove();
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    }
    document.body.append(pop);
    button.setAttribute('aria-expanded', 'true');
    // As wide as the field (not over the labels beside it), and never narrower than its content needs.
    const w = Math.max(r.width, 180);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.min(r.left, window.innerWidth - w - 8)}px`;
    // Under the button, or above it when there is no room below.
    const below = window.innerHeight - r.bottom;
    pop.style.top = below > 260 ? `${r.bottom + 4}px` : `${Math.max(8, r.top - 4 - Math.min(260, pop.offsetHeight || 260))}px`;
    window.addEventListener('pointerdown', outside, true);
    update();
    input.focus();
  }

  return el('div', { class: 'select' }, button);
}
