// The Library: the project's catalogs (wall types, floors, doors and windows, structure and circulation,
// objects, materials) reached as tabs of one window. They were six separate dialogs, each found by its own
// command under "edit", so the user had to know which held a type (docs/revisao-interface.md, J1). Each
// catalog keeps its own body; this bar on top goes from one to another without going back to the drawing.

import type { App } from '../session/app';
import { el } from './controls';
import { t, type MessageKey } from '../i18n/messages';
import { icon, type IconName } from '../i18n/icons';

export type LibraryTab = 'types' | 'floors' | 'openings' | 'presets' | 'objects' | 'materials';

const TABS: readonly { id: LibraryTab; action: string; label: MessageKey; icon: IconName }[] = [
  { id: 'types', action: 'type.edit', label: 'lib.walls', icon: 'wall' },
  { id: 'floors', action: 'floors.store', label: 'lib.floors', icon: 'slab' },
  { id: 'openings', action: 'openings.store', label: 'lib.openings', icon: 'door' },
  { id: 'presets', action: 'presets.store', label: 'lib.presets', icon: 'stair' },
  { id: 'objects', action: 'objects.edit', label: 'lib.objects', icon: 'box' },
  { id: 'materials', action: 'material.edit', label: 'lib.materials', icon: 'slab' },
];

/** The catalog's dialog with the Library's tabs over it, the one shown pressed. */
export function withLibrary(app: App, current: LibraryTab, close: () => void, dialog: HTMLElement): HTMLElement {
  const bar = el('div', { class: 'lib-tabs', role: 'tablist', 'aria-label': t('lib.title') }, el('span', { class: 'lib-title' }, t('lib.title')));
  for (const tab of TABS) {
    const b = el('button', { type: 'button', role: 'tab', class: 'lib-tab', 'aria-selected': String(tab.id === current) });
    b.innerHTML = icon(tab.icon, 16);
    b.append(el('span', {}, t(tab.label)));
    b.addEventListener('click', () => {
      if (tab.id === current) return;
      close();
      app.actionList().find((a) => a.id === tab.action)?.run();
    });
    bar.append(b);
  }
  dialog.prepend(bar);
  dialog.classList.add('in-library');
  return dialog;
}
