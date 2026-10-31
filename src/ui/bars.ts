// The bars' buttons, icons only, each for an action (session/actions.ts): the fixed bar of general commands,
// the tools' rail, the tool's or the selection's panel. A family of ways is one button with a caret, its
// members in a menu (ui/menu.ts) beside it, as the prototype's rail and context panel have them.

import type { Action } from '../session/actions';
import { tipOf } from '../session/actions';
import { el } from './controls';
import { type MessageKey, t } from '../i18n/messages';
import { icon, type IconName } from '../i18n/icons';
import { showMenu } from './menu';

export interface BarItem {
  /** The action it runs (session/actions.ts); a family's, the one its button runs if it has no menu. */
  readonly id: string;
  readonly icon: IconName;
  /** Its name in a family's menu, shorter than the action's (the full name stays the button's tip). */
  readonly short?: MessageKey;
  /** Its name as written, for one named by data (an object's definition). */
  readonly text?: string;
  /** Pressed: the tool in use, the way it draws, a mode that is on. */
  readonly pressed?: () => boolean;
  /** A family: a click opens its members beside it; the button shows the one in use, else the first. */
  readonly menu?: () => readonly BarItem[];
  /** It has more ways, chosen in the tool's panel once on: a small triangle in its corner says so. */
  readonly more?: boolean;
  /** A list rather than an icon (the object to place): its name written, a caret after it. */
  readonly list?: boolean;
}

/** A bar's contents: its items, '-' for a line between groups. */
export type BarEntry = BarItem | '-';

/** Where a family's menu opens: under its button (a bar across), or beside it (the rail down the left). */
export type MenuSide = 'below' | 'right';

/** An item's name: written by data, short, or the action's. */
const nameOf = (item: BarItem, action: Action): string => item.text ?? (item.short ? t(item.short) : action.label);

function openFamily(anchor: HTMLButtonElement, members: readonly BarItem[], actions: ReadonlyMap<string, Action>, side: MenuSide, label: string): void {
  const items = members.flatMap((m) => {
    const a = actions.get(m.id);
    return a ? [{ label: nameOf(m, a), icon: m.icon, ...(a.keys ? { keys: a.keys } : {}), disabled: !a.enabled, current: m.pressed?.() ?? false, run: a.run }] : [];
  });
  const r = anchor.getBoundingClientRect();
  anchor.setAttribute('aria-expanded', 'true');
  showMenu(items, side === 'right' ? { x: r.right + 4, y: r.top } : { x: r.left, y: r.bottom + 4 }, label, 0, () => anchor.setAttribute('aria-expanded', 'false'));
}

/** One button for its item: its icon, its action's name and key as its tip, dimmed when the action is off. */
export function barButton(item: BarItem, actions: ReadonlyMap<string, Action>, cls: string, side: MenuSide = 'below'): HTMLButtonElement | null {
  const members = item.menu?.() ?? null;
  const shown = members ? (members.find((m) => m.pressed?.()) ?? members[0]) : item;
  const action = actions.get(item.id) ?? (shown ? actions.get(shown.id) : undefined);
  if (!action || !shown) return null;
  const label = members ? `${nameOf(item, action)}: ${nameOf(shown, actions.get(shown.id) ?? action)}` : tipOf(action);
  const b = el('button', { type: 'button', class: item.list ? 'tdd' : cls, title: label, 'aria-label': label });
  b.dataset.action = item.id;
  if (item.list) b.append(el('span', { class: 'label' }, nameOf(item, action)));
  else b.innerHTML = icon(shown.icon, 16);
  const pressed = members ? members.some((m) => m.pressed?.()) : (item.pressed?.() ?? false);
  if (item.pressed || members) b.setAttribute('aria-pressed', String(pressed));
  if (members) {
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    if (item.list) b.insertAdjacentHTML('beforeend', icon('chevronDown', 14));
    else b.append(el('span', { class: 'tri', 'aria-hidden': 'true' }));
    b.addEventListener('click', () => openFamily(b, members, actions, side, nameOf(item, action)));
    return b;
  }
  if (item.more) b.append(el('span', { class: 'tri', 'aria-hidden': 'true' }));
  // Dimmed, still focusable: a disabled control is skipped by the keyboard and says nothing. A pressed one
  // is not dimmed (the view shown has nothing to switch to, and shows that it is on).
  if (!action.enabled && !pressed) b.setAttribute('aria-disabled', 'true');
  b.addEventListener('click', (e) => {
    if (action.enabled) action.run();
    // Clicked with the pointer, the keys go to the drawing again: Enter after Scale took the button and
    // started the tool over. From the keyboard it keeps the focus, where the user is.
    const now = document.activeElement;
    if (e.detail > 0 && now instanceof HTMLElement && now.dataset.action === item.id) now.blur();
  });
  return b;
}

/** A bar's buttons and the lines between their groups, none at either end nor two together. */
export function barButtons(entries: readonly BarEntry[], actions: ReadonlyMap<string, Action>, cls: string, side: MenuSide = 'below'): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const e of entries) {
    if (e === '-') {
      if (out.length > 0 && !out[out.length - 1]!.classList.contains('tsep')) out.push(el('span', { class: 'tsep', 'aria-hidden': 'true' }));
      continue;
    }
    const b = barButton(e, actions, cls, side);
    if (b) out.push(b);
  }
  if (out[out.length - 1]?.classList.contains('tsep')) out.pop();
  return out;
}

/** What a bar shows, to draw it again only when that changes: each item's action, name, key, state and pressed state. */
export function barKey(entries: readonly BarEntry[], actions: ReadonlyMap<string, Action>): string {
  const one = (i: BarItem): unknown[] => {
    const a = actions.get(i.id);
    return [i.id, i.text ?? '', a?.label ?? '', a?.keys ?? '', a?.enabled ?? null, i.pressed?.() ?? null, ...(i.menu?.() ?? []).flatMap(one)];
  };
  return JSON.stringify(entries.map((e) => (e === '-' ? e : one(e))));
}

/** Draws a bar into its box when what it shows changed, the focus kept on the same button. */
export function drawBar(box: HTMLElement, key: string, buttons: () => HTMLElement[]): void {
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  const active = document.activeElement instanceof HTMLElement && box.contains(document.activeElement) ? document.activeElement.dataset.action : undefined;
  box.replaceChildren(...buttons());
  if (active) box.querySelector<HTMLElement>(`[data-action="${active}"]`)?.focus();
}
