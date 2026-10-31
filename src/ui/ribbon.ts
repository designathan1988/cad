import type { Action } from '../session/actions';
import { el } from './controls';
import { getLang, type MessageKey, t } from '../i18n/messages';
import { icon, type IconName } from '../i18n/icons';
import type { App } from '../session/app';
import { contextEntries } from '../session/context-menu';
import { ribbonTabs } from './ribbon-tabs';
import { words } from '../elements/object/fields';
import * as appSettings from '../session/app-settings';


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
  /** Its name as written, for one named by what it is for (the element being placed). */
  readonly text?: string;
  readonly items: readonly RibbonItem[];
  /** Fields before its buttons (ui/fields.ts ribbonFieldRows): a tool's next element, set before the click. */
  readonly fields?: () => readonly HTMLElement[];
  /** What its fields show, so the ribbon is drawn again when that changes. */
  readonly key?: string;
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
    const rows = p.fields?.() ?? [];
    if (rows.length > 0) body.append(el('div', { class: 'rb-fields' }, ...rows));
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
    const title = p.text ?? t(p.title);
    return [el('div', { class: 'rb-panel', role: 'group', 'aria-label': title }, body, el('div', { class: 'rb-title', 'aria-hidden': 'true' }, title))];
  });
  box.replaceChildren(...panels);
  // The chosen tab's panel, named by it (ribbon tabs: aria-controls).
  box.setAttribute('role', 'tabpanel');
  box.removeAttribute('aria-label');
  box.setAttribute('aria-labelledby', `rb-tab-${tab.id}`);
}

/** The tabs' buttons: the File menu first, then one per tab, the chosen one pressed. */
export function renderRibbonTabs(box: HTMLElement, tabs: readonly RibbonTab[], chosen: string, onChoose: (id: string) => void, file: HTMLButtonElement): void {
  // Tabs as the pattern has them: the chosen one the only Tab stop, the arrows, Home and End going to and
  // choosing another, each linked to the ribbon it shows. Each was its own Tab stop and the arrows did nothing.
  const buttons = tabs.map((tab) => {
    const on = tab.id === chosen;
    const b = el('button', { type: 'button', role: 'tab', id: `rb-tab-${tab.id}`, class: tab.context ? 'rb-tab rb-tab-context' : 'rb-tab', 'aria-selected': String(on), 'aria-controls': 'ribbon-panel', tabindex: on ? '0' : '-1' }, tab.text ?? t(tab.title));
    b.dataset.tab = tab.id;
    b.addEventListener('click', () => onChoose(tab.id));
    b.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(tab);
      const n = tabs.length;
      const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
      if (to < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const id = tabs[to]!.id;
      onChoose(id);
      // Drawn again by the choice: the focus on the new tab once it is there.
      queueMicrotask(() => box.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus());
    });
    return b;
  });
  // Drawn again with the focus in the row (a tab clicked or chosen by the arrows): it stays, on the chosen tab.
  const inRow = document.activeElement instanceof HTMLElement && document.activeElement !== file && box.contains(document.activeElement);
  box.replaceChildren(file, ...buttons);
  if (inRow) buttons.find((b) => b.dataset.tab === chosen)?.focus();
  // On a narrow screen the tabs scroll: the chosen one is brought into sight (its ribbon showed with
  // its tab out of view).
  const active = buttons.find((b) => b.dataset.tab === chosen);
  if (active && box.scrollWidth > box.clientWidth) {
    const left = active.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + active.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = Math.max(0, left - (box.clientWidth - active.offsetWidth) / 2);
  }
}

/**
 * The ribbon's tabs and the chosen tab's panels (ui/ribbon.ts), from the app's actions: drawn again only
 * when what they show changes (the tab, the language, an action's name, key, state or pressed state).
 */
export function renderRibbon(app: App): void {
  const { shell } = app;
  const list = app.actionList();
  const actions = new Map(list.map((a) => [a.id, a]));
  // The selection's own actions (the context menu's), for the contextual tab: ctx.<id>.
  if (app.ui.selection.size > 0)
    for (const e of contextEntries(app, () => app.openCommands())) actions.set(`ctx.${e.id}`, { id: `ctx.${e.id}`, label: e.label, group: 'edit', keywords: '', ...(e.keys ? { keys: e.keys } : {}), enabled: true, run: e.run });
  const all = ribbonTabs(app);
  // A placing tool's tab ("Place wall") is the tool strip over the drawing now, not a tab of the ribbon.
  const placing = app.ui.tool !== 'select';
  const placeTab = placing ? all.find((x) => x.context) : undefined;
  const tabs = all.filter((x) => x !== placeTab);
  if (!tabs.some((x) => x.id === app.ribbonTab) || app.ribbonTab === 'context') app.ribbonTab = tabs[0]!.id;
  // The selection's tab (Modify | Wall) is shown, coloured apart, but never brought forward on its own:
  // the ribbon jumped to it on every click on the model (R2). The floating bar and the right-click menu
  // carry the selection's commands; a click on the tab opens it, until the selection changes.
  const contextual = tabs.find((x) => x.context);
  const selected = `${app.ui.tool} ${[...app.ui.selection].join(' ')}`;
  if (!contextual || selected !== app.ribbonSelected) app.ribbonAway = true;
  app.ribbonSelected = selected;
  const shown = contextual && !app.ribbonAway ? contextual.id : app.ribbonTab;
  const tab = tabs.find((x) => x.id === shown)!;
  renderToolStrip(app, placeTab, actions);
  const states = tab.panels.flatMap((p) => p.items.map((i) => {
    const a = actions.get(i.id);
    return a ? [i.id, a.label, a.keys ?? '', a.enabled, i.pressed?.() ?? null] : [i.id];
  }));
  // The selection too: the buttons run the actions made for it (the context's close over its ids), and kept
  // from a selection of two, Distribute on three windows spread two of them.
  const key = JSON.stringify([getLang(), shown, selected, tabs.map((x) => x.text ?? x.id), states, tab.panels.map((p) => p.key ?? '')]);
  if (key === app.ribbonKey) return;
  app.ribbonKey = key;
  // Keep the focus on the same button, or in the same field, across the rebuild.
  const active = document.activeElement instanceof HTMLElement && shell.ribbon.contains(document.activeElement) ? document.activeElement : null;
  const focused = active?.dataset.action;
  const field = active?.closest<HTMLElement>('[data-rf]')?.dataset.rf;
  renderRibbonTabs(shell.tabs, tabs, shown, (id) => appSettings.chooseRibbonTab(app, id), shell.fileMenu);
  renderRibbonTab(shell.ribbon, tab, actions);
  if (focused) shell.ribbon.querySelector<HTMLElement>(`[data-action="${focused}"]`)?.focus();
  else if (field) shell.ribbon.querySelector<HTMLElement>(`[data-rf="${field}"] input, [data-rf="${field}"] select, [data-rf="${field}"] button`)?.focus();
}

/**
 * The tool in use, over the top of the drawing: its name, its ways and types (the place tab's panels but
 * Select, which Esc and the way out stand for), and the way out. Drawn again only when what it shows changes.
 */
export function renderToolStrip(app: App, tab: RibbonTab | undefined, actions: ReadonlyMap<string, Action>): void {
  const { shell, ui } = app;
  const on = ui.tool !== 'select';
  shell.toolStrip.hidden = !on;
  shell.toolDone.hidden = !on;
  if (!on) {
    delete shell.toolStrip.dataset.key;
    return;
  }
  const panels = (tab?.panels ?? []).filter((p) => p.title !== 'rib.p.select');
  const states = panels.flatMap((p) => p.items.map((i) => [i.id, actions.get(i.id)?.label ?? '', i.pressed?.() ?? null]));
  const key = JSON.stringify([getLang(), ui.tool, tab?.text ?? '', states]);
  if (shell.toolStrip.dataset.key === key) return;
  shell.toolStrip.dataset.key = key;
  shell.toolName.textContent = tab?.text ?? '';
  shell.toolName.hidden = !tab?.text;
  renderRibbonTab(shell.toolBody, { id: 'tool', title: 'rib.tab.context', panels }, actions);
  shell.toolDone.replaceChildren(el('span', { class: 'label' }, t('opt.finish')), el('span', { class: 'kbd' }, 'Esc'));
  shell.toolDone.title = t('opt.finishTip');
}

/** The object tool's definition, named in the interface's language. */
export function objectName(app: App): string {
  const def = app.store.get().definitions.find((d) => d.id === app.ui.objectDef);
  return def ? words(def.name) : '';
}
