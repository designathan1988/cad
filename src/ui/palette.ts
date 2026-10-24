// The command palette (Ctrl+K): a field that finds any action by name, as the W3C APG combobox with a
// listbox (docs/adr/0002-ui-patterns.md). The focus stays in the field; arrows move the active
// option, Enter runs it, Esc closes and gives the focus back. Each option shows where the command
// lives and its key, as Blender's menu search does.

import type { Action } from '../app/actions';
import { el } from './controls';
import { t } from './i18n';
import { searchEntries } from './search';

let close: (() => void) | null = null;

export function showPalette(actions: readonly Action[]): void {
  close?.();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = el('div', { class: 'palette-back' });
  const input = el('input', {
    type: 'text',
    class: 'palette-input',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': 'palette-list',
    'aria-autocomplete': 'list',
    'aria-label': t('pal.title'),
    placeholder: t('pal.placeholder'),
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const list = el('ul', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': t('pal.title') });
  const status = el('div', { class: 'palette-status', role: 'status', 'aria-live': 'polite' });
  const dialog = el('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('pal.title') }, input, list, status);
  overlay.append(dialog);

  let shown: Action[] = [];
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
  const run = (a: Action | undefined) => {
    if (!a || !a.enabled) return;
    finish(false);
    a.run();
  };
  const update = () => {
    // Commands that cannot run now are listed after the rest, so Enter finds one that works.
    const found = searchEntries(actions, input.value);
    shown = [...found.filter((a) => a.enabled), ...found.filter((a) => !a.enabled)];
    list.replaceChildren(
      ...shown.map((a, i) => {
        const li = el(
          'li',
          { id: `palette-opt-${i}`, role: 'option', class: 'palette-option', 'aria-selected': 'false' },
          el('span', { class: 'palette-label' }, a.label),
          el('span', { class: 'palette-group' }, a.enabled ? a.group : `${a.group} · ${t('pal.disabled')}`),
        );
        if (a.keys) li.append(el('span', { class: 'kbd' }, a.keys));
        if (!a.enabled) li.setAttribute('aria-disabled', 'true');
        li.addEventListener('pointermove', () => active !== i && setActive(i));
        li.addEventListener('click', () => run(a));
        return li;
      }),
    );
    status.textContent = shown.length === 0 ? t('pal.empty', { q: input.value.trim() }) : shown.length === 1 ? t('pal.countOne') : t('pal.count', { n: shown.length });
    setActive(shown.length > 0 ? 0 : -1);
  };

  input.addEventListener('input', update);
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const n = shown.length;
    if (e.key === 'ArrowDown' && n > 0) setActive((active + 1) % n);
    else if (e.key === 'ArrowUp' && n > 0) setActive((active - 1 + n) % n);
    else if (e.key === 'Enter') run(shown[active]);
    else if (e.key === 'Escape') finish(true);
    else if (e.key === 'Tab') {
      // The dialog has one control: Tab stays in it.
    } else return;
    e.preventDefault();
  });
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) finish(true);
  });

  /** Closes it; the focus goes back to where it was when nothing ran (a command moves it itself). */
  function finish(restore: boolean): void {
    overlay.remove();
    close = null;
    if (restore) back?.focus();
  }
  close = () => finish(true);
  document.body.append(overlay);
  update();
  input.focus();
}
