// The ribbon (the interface model, docs/prototipo-interface: Revit's ribbon): tabs, and under the chosen
// one its panels of buttons, large with the label under the icon or small with it beside. Every button
// is an action of the app (app/actions.ts), so it has the palette's name, key and enabled state, and
// only what the app does is on it. What does not fit scrolls sideways, never wraps.

import type { Action } from '../app/actions';
import { el } from './controls';
import { t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';

export interface RibbonItem {
  /** The action it runs (app/actions.ts). */
  readonly id: string;
  readonly icon: IconName;
  /** Large: icon over its label, one per column. Small: icon beside its label, three to a column. */
  readonly size: 'L' | 'S';
  /** A shorter name for the button than the action's (its full name stays its tooltip). */
  readonly short?: MessageKey;
  /** Its name as written, for one named by data (an object's definition). */
  readonly text?: string;
  /** Pressed: the tool in use, the view shown, a mode that is on. */
  readonly pressed?: () => boolean;
  /** Dimmed, a click still runs it, to say what it needs (the Modify tools with nothing selected). */
  readonly explains?: boolean;
  /** A button with a list (the Objects one): a click opens its items under it instead of running it. */
  readonly menu?: () => readonly RibbonItem[];
}

export interface RibbonPanel {
  readonly title: MessageKey;
  readonly items: readonly RibbonItem[];
}

export interface RibbonTab {
  readonly id: string;
  readonly title: MessageKey;
  /** Its name as written, for one named by what it is for (Modify | Wall). */
  readonly text?: string;
  /** A contextual tab (Revit's Modify | …): shown for the selection, coloured apart. */
  readonly context?: boolean;
  readonly panels: readonly RibbonPanel[];
}

/** One button of the ribbon, for its action; disabled when the action is (with the palette's reason). */
function button(item: RibbonItem, action: Action, actions: ReadonlyMap<string, Action>): HTMLButtonElement {
  const label = item.text ?? (item.short ? t(item.short) : action.label);
  const tip = action.keys ? `${action.label} (${action.keys})` : action.label;
  const b = el('button', { type: 'button', class: item.size === 'L' ? 'rb-large' : 'rb-small', title: tip, 'aria-label': item.menu ? label : tip });
  b.dataset.action = item.id;
  b.innerHTML = icon(item.icon, item.size === 'L' ? 24 : 16);
  b.append(el('span', { class: 'rb-label' }, label));
  const pressed = item.pressed?.() ?? false;
  if (item.pressed) b.setAttribute('aria-pressed', String(pressed));
  if (item.menu) {
    const list = item.menu;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.removeAttribute('title');
    b.append(el('span', { class: 'rb-caret', 'aria-hidden': 'true' }, '▾'));
    b.addEventListener('click', () => openMenu(b, list(), actions));
    return b;
  }
  // Dimmed, still focusable: a disabled control is skipped by the keyboard and says nothing. A pressed
  // one is not dimmed (the view shown has nothing to switch to, and shows that it is on).
  if (!action.enabled && !pressed) b.setAttribute('aria-disabled', 'true');
  b.addEventListener('click', (e) => {
    if (action.enabled || item.explains) action.run();
    // Clicked with the pointer, the keys go to the drawing again: Enter after Scale took the button
    // and started the tool over, instead of taking the selection's centre. From the keyboard it keeps
    // the focus, where the user is. The ribbon is drawn again by the action, its focus moved to this
    // button's new copy (chrome.ts): that one lets go of it.
    const now = document.activeElement;
    if (e.detail > 0 && now instanceof HTMLElement && now.dataset.action === item.id) now.blur();
  });
  return b;
}

/**
 * A button's list, under it, over everything: each item runs its action and closes it; a click outside,
 * Escape or a ribbon drawn again (its button gone) closes it. Arrow keys move along it.
 */
function openMenu(anchor: HTMLButtonElement, items: readonly RibbonItem[], actions: ReadonlyMap<string, Action>): void {
  document.querySelector('.rb-menu')?.remove();
  const menu = el('div', { class: 'rb-menu', role: 'menu' });
  const close = () => {
    menu.remove();
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keys, true);
  };
  const outside = (e: Event) => {
    if (!menu.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) close();
  };
  const entries = items.flatMap((item) => {
    const action = actions.get(item.id);
    if (!action) return [];
    const label = item.text ?? (item.short ? t(item.short) : action.label);
    const b = el('button', { type: 'button', class: 'rb-menu-item', role: 'menuitem', title: action.label });
    b.innerHTML = icon(item.icon, 16);
    b.append(el('span', {}, label));
    if (item.pressed?.()) b.setAttribute('aria-current', 'true');
    if (!action.enabled) b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', () => {
      close();
      if (action.enabled) action.run();
    });
    return [b];
  });
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      anchor.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    entries[(at + (e.key === 'ArrowDown' ? 1 : entries.length - 1) + entries.length) % entries.length]?.focus();
  };
  menu.append(...entries);
  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.round(r.left)}px`;
  menu.style.top = `${Math.round(r.bottom)}px`;
  document.body.append(menu);
  // Kept inside the window on its right.
  const over = menu.getBoundingClientRect().right - window.innerWidth;
  if (over > 0) menu.style.left = `${Math.max(0, Math.round(r.left - over))}px`;
  anchor.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keys, true);
  entries[0]?.focus();
}

/**
 * The panels of a tab into `box`: large buttons each in a column, small ones three to a column, the
 * panel's title under them. An item whose action the app does not have is left out.
 */
export function renderRibbonTab(box: HTMLElement, tab: RibbonTab, actions: ReadonlyMap<string, Action>): void {
  const panels = tab.panels.flatMap((p) => {
    const body = el('div', { class: 'rb-body' });
    let column: HTMLElement | null = null;
    for (const item of p.items) {
      const action = actions.get(item.id);
      if (!action) continue;
      const b = button(item, action, actions);
      if (item.size === 'L') {
        column = null;
        body.append(b);
        continue;
      }
      if (!column || column.childElementCount === 3) {
        column = el('div', { class: 'rb-column' });
        body.append(column);
      }
      column.append(b);
    }
    if (body.childElementCount === 0) return [];
    return [el('div', { class: 'rb-panel', role: 'group', 'aria-label': t(p.title) }, body, el('div', { class: 'rb-title', 'aria-hidden': 'true' }, t(p.title)))];
  });
  box.replaceChildren(...panels);
  box.setAttribute('aria-label', t(tab.title));
}

/** The tabs' buttons: the File menu first, then one per tab, the chosen one pressed. */
export function renderRibbonTabs(box: HTMLElement, tabs: readonly RibbonTab[], chosen: string, onChoose: (id: string) => void, file: HTMLButtonElement): void {
  const buttons = tabs.map((tab) => {
    const b = el('button', { type: 'button', role: 'tab', class: tab.context ? 'rb-tab rb-tab-context' : 'rb-tab', 'aria-selected': String(tab.id === chosen) }, tab.text ?? t(tab.title));
    b.dataset.tab = tab.id;
    b.addEventListener('click', () => onChoose(tab.id));
    return b;
  });
  box.replaceChildren(file, ...buttons);
  // On a narrow screen the tabs scroll: the chosen one is brought into sight (its ribbon showed with
  // its tab out of view).
  const active = buttons.find((b) => b.dataset.tab === chosen);
  if (active && box.scrollWidth > box.clientWidth) {
    const left = active.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + active.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = Math.max(0, left - (box.clientWidth - active.offsetWidth) / 2);
  }
}
