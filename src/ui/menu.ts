// A short menu at a point (the right-click menu): role="menu", keys as in menu-keys.ts. Clicking an
// item runs it; clicking anywhere else, Esc or Tab closes it, and the focus goes back where it was.

import { el } from './controls';
import { icon, type IconName } from './icons';
import { menuKey } from './menu-keys';

export interface MenuItem {
  readonly label: string;
  /** Drawn before the label: the icon of the button the item stands for. */
  readonly icon?: IconName;
  /** The key that does the same, shown at the right. */
  readonly keys?: string;
  readonly disabled?: boolean;
  /** Draws a line before this item, to group the items. */
  readonly separated?: boolean;
  readonly run: () => void;
}

let open: (() => void) | null = null;

/** Opens the menu with its top-left corner at the screen point, kept inside the window. */
export function showMenu(items: readonly MenuItem[], at: { x: number; y: number }, label: string, start = 0): void {
  open?.();
  if (items.length === 0) return;
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const menu = el('div', { class: 'menu', role: 'menu', 'aria-label': label });
  const buttons = items.map((item) => {
    const b = el('button', { type: 'button', role: 'menuitem', class: 'menu-item', tabindex: '-1' }, el('span', { class: 'menu-label' }, item.label));
    if (item.icon) b.insertAdjacentHTML('afterbegin', icon(item.icon, 16));
    if (item.keys) b.append(el('span', { class: 'menu-keys' }, item.keys));
    if (item.disabled) b.setAttribute('aria-disabled', 'true');
    if (item.separated) b.classList.add('separated');
    b.addEventListener('click', () => {
      if (item.disabled) return;
      close();
      item.run();
    });
    menu.append(b);
    return b;
  });
  let index = 0;
  const focus = (i: number) => {
    index = i;
    buttons[i]!.focus();
  };
  menu.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const r = menuKey(
      items.map((x) => ({ label: x.label, disabled: x.disabled === true })),
      index,
      e.key,
    );
    if (!r) return;
    e.preventDefault();
    if (r.close) return close();
    if (r.run) {
      close();
      return items[r.index]!.run();
    }
    focus(r.index);
  });
  buttons.forEach((b, i) => b.addEventListener('pointermove', () => index !== i && focus(i)));
  const outside = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node)) close();
  };
  function close(): void {
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', close);
    menu.remove();
    open = null;
    back?.focus();
  }
  document.body.append(menu);
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = `${Math.max(4, Math.min(at.x, window.innerWidth - w - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(at.y, window.innerHeight - h - 4))}px`;
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', close);
  open = close;
  // The first item that can be chosen, from `start`: a greyed one never takes the focus first.
  const first = items.findIndex((x, i) => i >= start && !x.disabled);
  focus(first >= 0 ? first : Math.min(start, items.length - 1));
}
