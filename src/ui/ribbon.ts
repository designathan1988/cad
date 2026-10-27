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
}

export interface RibbonPanel {
  readonly title: MessageKey;
  readonly items: readonly RibbonItem[];
}

export interface RibbonTab {
  readonly id: string;
  readonly title: MessageKey;
  readonly panels: readonly RibbonPanel[];
}

/** One button of the ribbon, for its action; disabled when the action is (with the palette's reason). */
function button(item: RibbonItem, action: Action): HTMLButtonElement {
  const label = item.text ?? (item.short ? t(item.short) : action.label);
  const tip = action.keys ? `${action.label} (${action.keys})` : action.label;
  const b = el('button', { type: 'button', class: item.size === 'L' ? 'rb-large' : 'rb-small', title: tip, 'aria-label': tip });
  b.dataset.action = item.id;
  b.innerHTML = icon(item.icon, item.size === 'L' ? 24 : 16);
  b.append(el('span', { class: 'rb-label' }, label));
  const pressed = item.pressed?.() ?? false;
  if (item.pressed) b.setAttribute('aria-pressed', String(pressed));
  // Dimmed, still focusable: a disabled control is skipped by the keyboard and says nothing. A pressed
  // one is not dimmed (the view shown has nothing to switch to, and shows that it is on).
  if (!action.enabled && !pressed) b.setAttribute('aria-disabled', 'true');
  b.addEventListener('click', () => {
    if (action.enabled || item.explains) action.run();
  });
  return b;
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
      const b = button(item, action);
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
    const b = el('button', { type: 'button', role: 'tab', class: 'rb-tab', 'aria-selected': String(tab.id === chosen) }, t(tab.title));
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
