// The tools' rail, icons only, down the drawing's left edge, in groups: select and measure; what builds;
// the structure; the objects; what annotates. A tool with more ways has a small triangle: its ways are in the
// tool's panel once it is on (ui/context-panel.ts). The objects are a family: their list opens beside it.

import { words } from '../elements/object/fields';
import type { ObjectDefinition } from '../elements/object/schema';
import type { Action } from '../session/actions';
import type { App } from '../session/app';
import { el } from './controls';
import { type MessageKey, t } from '../i18n/messages';
import type { ToolId } from './shell';
import { type BarItem, barButtons, barKey, drawBar } from './bars';

/** At most this many objects in the objects' list: the rest are in the objects dialog, which places them too. */
export const LISTED_OBJECTS = 8;

/**
 * The objects the list shows, in the library's order: the one being placed and those the project has placed
 * first, then the library's first ones up to LISTED_OBJECTS. A long library no longer makes a list past the window.
 */
export function listedObjects(app: Pick<App, 'store' | 'ui'>): readonly ObjectDefinition[] {
  const doc = app.store.get();
  const wanted = new Set<string>();
  if (app.ui.tool === 'object' && app.ui.objectDef) wanted.add(app.ui.objectDef);
  for (const o of doc.objects) if (wanted.size < LISTED_OBJECTS) wanted.add(o.definitionId);
  for (const d of doc.definitions) if (wanted.size < LISTED_OBJECTS) wanted.add(d.id);
  return doc.definitions.filter((d) => wanted.has(d.id));
}

/** The objects' family: the listed ones, the dialog with them all, a model imported as one. */
export function objectFamily(app: App, list = false): BarItem {
  const { ui } = app;
  const def = list ? app.store.get().definitions.find((d) => d.id === ui.objectDef) : undefined;
  return {
    id: 'objects.edit',
    icon: 'box',
    short: 'rib.s.objectTool',
    ...(def ? { text: words(def.name) } : {}),
    list,
    pressed: () => ui.tool === 'object',
    menu: () => [
      ...listedObjects(app).map((d): BarItem => ({ id: `tool.object.${d.id}`, icon: 'box', text: words(d.name), pressed: () => ui.tool === 'object' && ui.objectDef === d.id })),
      { id: 'objects.edit', icon: 'plus', short: 'rib.s.objectsMore' },
      { id: 'model.import', icon: 'box' },
    ],
  };
}

export function railGroups(app: App): readonly { readonly name: MessageKey; readonly items: readonly BarItem[] }[] {
  const { ui } = app;
  const on = (...tools: ToolId[]) => () => tools.includes(ui.tool);
  return [
    { name: 'rib.p.select', items: [{ id: 'tool.select', icon: 'pointer', pressed: on('select') }, { id: 'tool.measure', icon: 'ruler', pressed: on('measure') }] },
    {
      name: 'rib.p.build',
      items: [
        { id: 'tool.wall', icon: 'wall', pressed: on('wall', 'curtain'), more: true },
        { id: 'tool.door', icon: 'door', pressed: on('door') },
        { id: 'tool.window', icon: 'window', pressed: on('window') },
        { id: 'tool.floor', icon: 'slab', pressed: on('floor'), more: true },
        { id: 'tool.room', icon: 'room', pressed: on('room', 'separator'), more: true },
        { id: 'tool.roof', icon: 'roof', pressed: on('roof') },
        { id: 'tool.stair', icon: 'stair', pressed: on('stair', 'railing'), more: true },
      ],
    },
    { name: 'rib.p.structure', items: [{ id: 'tool.column', icon: 'column', pressed: on('column') }, { id: 'tool.beam', icon: 'beam', pressed: on('beam') }, { id: 'tool.grid', icon: 'hash', pressed: on('grid') }] },
    { name: 'rib.p.objects', items: [objectFamily(app)] },
    {
      name: 'rib.p.annotation',
      items: [
        { id: 'tool.dimension', icon: 'dimension', pressed: on('dimension', 'mark', 'levelMark'), more: true },
        { id: 'edit.addNote', icon: 'text', pressed: on('note', 'callout'), more: true },
        { id: 'tool.section', icon: 'cut', pressed: on('section') },
        { id: 'tool.guideLine', icon: 'guide', pressed: on('guide'), more: true },
      ],
    },
  ];
}

export function renderRail(app: App, actions: ReadonlyMap<string, Action>): void {
  const groups = railGroups(app);
  const key = barKey(groups.flatMap((g) => g.items), actions) + t('rib.p.select');
  drawBar(app.shell.rail, key, () =>
    groups.flatMap((g) => {
      const buttons = barButtons(g.items, actions, 'rt', 'right');
      return buttons.length > 0 ? [el('div', { class: 'rail-group', role: 'group', 'aria-label': t(g.name) }, ...buttons)] : [];
    }),
  );
}
