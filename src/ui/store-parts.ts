// The parts every store dialog shares (objects, types, openings, presets, floors): a folder in the side
// list and the search field. What a choice or a search then does is the dialog's own.

import { el } from './controls';
import { icon } from '../i18n/icons';

/** A folder in a store's side list: its name and how many it holds, pressed while it is the one shown. */
export function folderButton(key: string, label: string, n: number, pressed: boolean, choose: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'objs-nav-item', 'aria-pressed': String(pressed) }, el('span', { class: 'objs-nav-name' }, label), el('span', { class: 'objs-nav-count' }, String(n)));
  b.dataset.focus = `folder:${key}`;
  b.addEventListener('click', choose);
  return b;
}

/** A store's search field, holding `value`; typing hands the text to onInput. */
export function storeSearch(label: string, value: string, onInput: (value: string) => void): HTMLInputElement {
  const search = el('input', { type: 'search', class: 'objs-search', placeholder: label, 'aria-label': label });
  search.value = value;
  search.dataset.focus = 'search';
  search.addEventListener('input', () => onInput(search.value));
  return search;
}

/** A button that is an icon, named by its tip and its label (a store's close, more, add). */
export function iconButton(name: Parameters<typeof icon>[0], label: string, focus: string, run: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label });
  b.innerHTML = icon(name, 18);
  b.dataset.focus = focus;
  b.addEventListener('click', run);
  return b;
}

/** A button of words, as quiet as the icon ones (Edit..., Duplicate). */
export function textButton(label: string, focus: string, run: () => void): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
  b.dataset.focus = focus;
  b.addEventListener('click', run);
  return b;
}
