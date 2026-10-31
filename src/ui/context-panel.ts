// The tool's or the selection's panel, floating at the top of the drawing: what only the tool in use does
// (its ways, a wall by line, rectangle or arc; its types' store) or what only the selected element does (a
// wall's flip, offset and geometry; a door's hinge), and the way out of a tool. What any selection takes is
// the fixed bar's (ui/command-bar.ts); the next element's settings are the properties panel's.

import type { Action } from '../session/actions';
import type { App } from '../session/app';
import { type MessageKey, t } from '../i18n/messages';
import { words } from '../elements/object/fields';
import { kindOfId } from '../elements/registry';
import { menuEntries } from '../session/context-menu';
import { ceilingOf } from '../elements/tool-draft';
import { getLang } from '../i18n/messages';
import { icon } from '../i18n/icons';
import { el } from './controls';
import { type BarEntry, type BarItem, barButtons, barKey, drawBar } from './bars';
import { objectFamily } from './tool-rail';

/** A name inside a sentence: its first letter small ("Colocar sofá"), an acronym ("TV") kept. */
export const lowerFirst = (s: string): string => (s.length > 1 && s[1] === s[1]!.toUpperCase() && s[1] !== s[1]!.toLowerCase() ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** The tool's name: "Colocar parede", the floor tool's "Colocar forro" when it makes ceilings, an object's by what it is. */
export function placeName(app: App): string {
  const { ui } = app;
  if (ui.tool === 'floor' && ceilingOf(ui.draft)) return t('rib.place.ceiling');
  if (ui.tool === 'object') {
    const def = app.store.get().definitions.find((d) => d.id === ui.objectDef);
    return t('rib.place.object', { what: def ? lowerFirst(words(def.name)) : '' });
  }
  // The edits' tools are named as their commands are.
  if (ui.tool === 'modify') return t(`pal.${ui.modify?.kind ?? 'move'}` as MessageKey);
  if (ui.tool === 'split' || ui.tool === 'corner') return t(`pal.${ui.tool}`);
  return t(`rib.place.${ui.tool}` as MessageKey);
}

/** The context's own actions on the panel (context-menu.ts): what a wall, a door, a room offers. */
const ELEMENT_ACTIONS = new Set(['flipWall', 'editType', 'toggleOpen', 'flipHinge', 'flipSwing', 'centerOpening', 'addFloor', 'addCeiling', 'distribute', 'section']);

/** The app's actions, with the selection's own (the context menu's) as `ctx.<id>`. */
export function actionsWithContext(app: App): Map<string, Action> {
  const actions = new Map(app.actionList().map((a) => [a.id, a]));
  if (app.ui.selection.size > 0)
    for (const e of menuEntries(app, () => app.openCommands()).flat()) actions.set(`ctx.${e.id}`, { id: `ctx.${e.id}`, label: e.label, group: 'edit', keywords: '', ...(e.keys ? { keys: e.keys } : {}), enabled: true, run: e.run });
  return actions;
}

/** The tool's own: its ways, then the store of its types. */
function toolItems(app: App): readonly BarEntry[] {
  const { ui } = app;
  const store: Partial<Record<string, BarItem>> = {
    wall: { id: 'type.edit', icon: 'wall' },
    door: { id: 'openings.store', icon: 'door' },
    window: { id: 'openings.store', icon: 'window' },
    floor: { id: 'floors.store', icon: 'slab' },
    ...Object.fromEntries(['column', 'beam', 'stair', 'railing', 'roof', 'curtain'].map((k) => [k, { id: 'presets.store', icon: 'box' } as BarItem])),
  };
  const isRect = ui.wall.kind === 'rect' || (ui.wall.kind === 'idle' && ui.wall.rect === true);
  const isArc = 'arc' in ui.wall && ui.wall.arc === true;
  const tool = (id: string, icon: BarItem['icon'], ...tools: string[]): BarItem => ({ id, icon, pressed: () => tools.includes(ui.tool) });
  const ways: readonly BarEntry[] =
    ui.tool === 'wall' || ui.tool === 'curtain'
      ? [
          { id: 'tool.wall', icon: 'wall', short: 'rib.s.wallLine', pressed: () => ui.tool === 'wall' && !isRect && !isArc },
          { id: 'tool.rectWall', icon: 'room', pressed: () => ui.tool === 'wall' && isRect },
          { id: 'tool.arcWall', icon: 'radius', pressed: () => ui.tool === 'wall' && isArc },
          '-',
          tool('tool.curtain', 'window', 'curtain'),
        ]
      : ui.tool === 'floor'
        ? [
            { id: 'tool.floor', icon: 'slab', pressed: () => !ceilingOf(ui.draft) },
            { id: 'tool.ceiling', icon: 'arrowUp', pressed: () => ceilingOf(ui.draft) },
          ]
        : ui.tool === 'guide'
          ? [
              {
                id: 'tool.guideLine',
                icon: 'guide',
                short: 'rib.p.guides',
                menu: () => [
                  { id: 'tool.guideLine', icon: 'guide', pressed: () => ui.guideMode === 'line' },
                  { id: 'tool.guidePoint', icon: 'center', pressed: () => ui.guideMode === 'point' },
                  { id: 'tool.guideCircle', icon: 'radius', pressed: () => ui.guideMode === 'circle' },
                ],
              },
              '-',
              { id: 'edit.clearGuides', icon: 'trash' },
            ]
          : ui.tool === 'mark' || ui.tool === 'dimension' || ui.tool === 'levelMark'
            ? [
                {
                  id: 'tool.dimension',
                  icon: 'dimension',
                  short: 'rib.p.dims',
                  menu: () => [
                    tool('tool.dimension', 'dimension', 'dimension'),
                    { id: 'mark.angle', icon: 'corner', pressed: () => ui.tool === 'mark' && ui.markMode === 'angle' },
                    { id: 'mark.radius', icon: 'radius', pressed: () => ui.tool === 'mark' && ui.markMode === 'radius' },
                    tool('edit.addLevelMark', 'height', 'levelMark'),
                    { id: 'mark.coord', icon: 'pin', pressed: () => ui.tool === 'mark' && ui.markMode === 'coord' },
                  ],
                },
                '-',
                { id: 'dim.auto', icon: 'wand' },
              ]
            : ui.tool === 'note' || ui.tool === 'callout'
              ? [tool('edit.addNote', 'text', 'note'), tool('tool.callout', 'tag', 'callout')]
              : ui.tool === 'object'
                ? [objectFamily(app, true)]
                : ui.tool === 'stair' || ui.tool === 'railing'
                  ? [tool('tool.stair', 'stair', 'stair'), tool('tool.railing', 'railing', 'railing')]
                  : ui.tool === 'room' || ui.tool === 'separator'
                    ? [tool('tool.room', 'room', 'room'), tool('tool.separator', 'split', 'separator')]
                    : ui.tool === 'section'
                      ? [{ id: 'section.elevations', icon: 'home' }]
                      : [];
  const own = store[ui.tool];
  return [...ways, ...(own ? ['-' as const, own] : [])];
}

/** The selection's own: its element's actions, a wall's offset and geometry, aligning two or more. */
function selectionItems(app: App): readonly BarEntry[] {
  const { ui } = app;
  const doc = app.store.get();
  const ids = [...ui.selection];
  const own = menuEntries(app, () => app.openCommands())
    .flat()
    .filter((e) => ELEMENT_ACTIONS.has(e.id))
    .map((e): BarItem => ({ id: `ctx.${e.id}`, icon: e.icon }));
  const walls = ids.some((id) => doc.walls.some((w) => w.id === id));
  const rooms = ids.some((id) => doc.rooms.some((r) => r.id === id));
  const align = (['left', 'centerX', 'right', 'top', 'centerY', 'bottom', 'spreadX', 'spreadY'] as const).map(
    (k): BarItem => ({ id: `arrange.${k}`, icon: ({ left: 'alignLeft', centerX: 'alignCenterX', right: 'alignRight', top: 'alignTop', centerY: 'alignCenterY', bottom: 'alignBottom', spreadX: 'distribute', spreadY: 'distributeY' } as const)[k] }),
  );
  return [
    ...own,
    ...(rooms ? [{ id: 'zone.make', icon: 'tag' } as BarItem] : []),
    ...(walls ? ['-' as const, { id: 'edit.offset', icon: 'offset' } as BarItem, { id: 'edit.split', icon: 'split', short: 'rib.p.geometry', menu: () => [{ id: 'edit.split', icon: 'split' }, { id: 'edit.corner', icon: 'corner' }, { id: 'edit.merge', icon: 'merge' }] } as BarItem] : []),
    ...(ids.length > 1 ? ['-' as const, { id: 'arrange.left', icon: 'alignLeft', short: 'rib.p.arrange', menu: () => align } as BarItem] : []),
  ];
}

/** What is selected, named: "Parede", "3 paredes", "Porta". */
function selectionName(app: App): string {
  const doc = app.store.get();
  const ids = [...app.ui.selection];
  const kinds = new Set(ids.map((id) => kindOfId(id)));
  const kind = kinds.size === 1 ? [...kinds][0] : null;
  const openings = ids.map((id) => doc.openings.find((o) => o.id === id));
  if (openings.every((o) => o !== undefined)) return ids.length === 1 ? t(openings[0]!.kind === 'door' ? 'panel.door' : 'panel.window') : t('panel.openings', { n: ids.length });
  return kind ? (ids.length === 1 ? t(kind.one) : t(kind.many, { n: ids.length })) : t('rib.tab.contextMany', { n: ids.length });
}

/**
 * The panel: a tool's while one is on (with its way out), else the selection's when it has something of its
 * own. Drawn again only when what it shows changes.
 */
export function renderContextPanel(app: App, actions: ReadonlyMap<string, Action>): void {
  const { shell, ui } = app;
  const tool = ui.tool !== 'select';
  const items = tool ? toolItems(app) : ui.selection.size > 0 ? selectionItems(app) : [];
  shell.toolStrip.hidden = !tool && items.length === 0;
  shell.toolDone.hidden = !tool;
  if (shell.toolStrip.hidden) return;
  const name = tool ? placeName(app) : selectionName(app);
  shell.toolStrip.setAttribute('aria-label', name);
  drawBar(shell.toolBody, `${getLang()}|${ui.tool}|${[...ui.selection].join(',')}|${barKey(items, actions)}`, () => barButtons(items, actions, 'ti'));
  shell.toolBody.hidden = shell.toolBody.childElementCount === 0;
  const done = `${getLang()}|done`;
  if (shell.toolDone.dataset.key !== done) {
    shell.toolDone.dataset.key = done;
    shell.toolDone.innerHTML = icon('check', 16);
    shell.toolDone.append(el('span', { class: 'label' }, t('opt.finish')), el('span', { class: 'u' }, 'Esc'));
    shell.toolDone.title = t('opt.finishTip');
  }
}
