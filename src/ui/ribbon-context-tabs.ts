// The ribbon's tabs that come and go: a placing tool's own tab (its next element's fields) and the
// contextual tab of the selection (Modify | Wall).

import type { ToolId } from './shell';
import type { RibbonItem, RibbonTab } from './ribbon';
import type { App } from '../session/app';
import { type MessageKey, t } from '../i18n/messages';
import { words } from '../elements/object/fields';
import type { ModifyKind } from '../session/modify-tool';
import { kindOfId } from '../elements/registry';
import { contextEntries } from '../session/context-menu';
import { ceilingOf } from '../elements/tool-draft';

/** The tools that place something, each with its own tab while in use; the Modify tools (modify, split, corner) keep theirs. */
export const PLACING: Partial<Record<ToolId, RibbonItem['icon']>> = {
  wall: 'wall',
  door: 'door',
  window: 'window',
  room: 'room',
  floor: 'slab',
  column: 'column',
  beam: 'beam',
  separator: 'split',
  mark: 'corner',
  curtain: 'window',
  note: 'text',
  levelMark: 'height',
  roof: 'roof',
  stair: 'stair',
  railing: 'railing',
  grid: 'hash',
  object: 'box',
  measure: 'ruler',
  dimension: 'dimension',
  guide: 'guide',
  section: 'cut',
  callout: 'text',
  calibrate: 'ruler',
};

/** A name inside a sentence: its first letter small ("Colocar sofá"), an acronym ("TV") kept. */
export const lowerFirst = (s: string): string => (s.length > 1 && s[1] === s[1]!.toUpperCase() && s[1] !== s[1]!.toLowerCase() ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** The tab's name: "Colocar parede", the floor tool's "Colocar forro" when it makes ceilings, an object's by what it is. */
export function placeName(app: App): string {
  const { ui } = app;
  if (ui.tool === 'floor' && ceilingOf(ui.draft)) return t('rib.place.ceiling');
  if (ui.tool === 'object') {
    const def = app.store.get().definitions.find((d) => d.id === ui.objectDef);
    return t('rib.place.object', { what: def ? lowerFirst(words(def.name)) : '' });
  }
  return t(`rib.place.${ui.tool}` as MessageKey);
}

/**
 * The tab of the tool in use, as the interface model has it (prototype v7: "Selecionar | Tipo | the
 * element's own choices | the tool's panels"): Select; the next element's type and its own fields, set
 * before the click and what the tool makes (next-element.ts, the walls' and openings' defaults); then
 * the tool's ways (a wall by line, rectangle or arc; floor or ceiling; the guide's, the mark's). Shown
 * on choosing the tool, as Revit brings its Modify | Place tab forward.
 */
export function placeTab(
  app: App,
  select: RibbonTab['panels'][number],
  tool: (id: ToolId, action: string, icon: RibbonItem['icon'], size: 'L' | 'S', short?: MessageKey) => RibbonItem,
  objects: RibbonItem,
): RibbonTab[] {
  const { ui } = app;
  if (!PLACING[ui.tool]) return [];
  // The next element's settings are the properties panel's (frame.ts: next), as Revit's palette and
  // Archicad's Info Box hold them: the ribbon keeps the tool's commands only. Its fields here were a
  // second copy of the panel's, a strip of form controls across the top of the screen.
  const typeEdit: RibbonItem[] =
    ui.tool === 'wall' ? [{ id: 'type.edit', icon: 'wall', size: 'S' }] : ui.tool === 'object' ? [{ id: 'objects.edit', icon: 'box', size: 'S', short: 'rib.s.objectsEdit' }] : ui.tool === 'door' || ui.tool === 'window' ? [{ id: 'openings.store', icon: ui.tool, size: 'S' }] : ui.tool === 'floor' ? [{ id: 'floors.store', icon: 'slab', size: 'S' }] : ['column', 'beam', 'stair', 'railing', 'roof', 'curtain'].includes(ui.tool) ? [{ id: 'presets.store', icon: 'box', size: 'S' }] : [];
  const properties: RibbonItem = { id: 'settings.panel', icon: 'panel', size: 'S', short: 'rib.s.properties', pressed: () => !app.shell.panel.hidden };
  const name = placeName(app);
  // The tool's own ways, as the other tabs have them.
  const isRect = ui.wall.kind === 'rect' || (ui.wall.kind === 'idle' && ui.wall.rect === true);
  const isArc = 'arc' in ui.wall && ui.wall.arc === true;
  const ways: RibbonTab['panels'] =
    ui.tool === 'wall'
      ? [
          {
            title: 'rib.p.draw',
            items: [
              { id: 'tool.wall', icon: 'wall', size: 'L', short: 'rib.s.wallLine', pressed: () => ui.tool === 'wall' && !isRect && !isArc },
              { id: 'tool.rectWall', icon: 'wall', size: 'S', pressed: () => ui.tool === 'wall' && isRect },
              { id: 'tool.arcWall', icon: 'radius', size: 'S', pressed: () => ui.tool === 'wall' && isArc },
            ],
          },
        ]
      : ui.tool === 'floor'
        ? [{ title: 'rib.p.draw', items: [{ ...tool('floor', 'tool.floor', 'slab', 'L'), pressed: () => ui.tool === 'floor' && !ceilingOf(ui.draft) }, { id: 'tool.ceiling', icon: 'arrowUp', size: 'L', pressed: () => ui.tool === 'floor' && ceilingOf(ui.draft) }] }]
        : ui.tool === 'guide'
          ? [
              {
                title: 'rib.p.draw',
                items: [
                  { id: 'tool.guideLine', icon: 'guide', size: 'L', pressed: () => ui.guideMode === 'line' },
                  { id: 'tool.guidePoint', icon: 'center', size: 'S', pressed: () => ui.guideMode === 'point' },
                  { id: 'tool.guideCircle', icon: 'radius', size: 'S', pressed: () => ui.guideMode === 'circle' },
                  { id: 'edit.clearGuides', icon: 'guide', size: 'S' },
                ],
              },
            ]
          : ui.tool === 'mark' || ui.tool === 'dimension' || ui.tool === 'levelMark'
            ? [
                {
                  title: 'rib.p.dims',
                  items: [
                    tool('dimension', 'tool.dimension', 'dimension', 'L'),
                    { id: 'mark.angle', icon: 'corner', size: 'S', pressed: () => ui.tool === 'mark' && ui.markMode === 'angle' },
                    { id: 'mark.radius', icon: 'radius', size: 'S', pressed: () => ui.tool === 'mark' && ui.markMode === 'radius' },
                    tool('levelMark', 'edit.addLevelMark', 'height', 'S'),
                    { id: 'mark.coord', icon: 'pin', size: 'S', pressed: () => ui.tool === 'mark' && ui.markMode === 'coord' },
                    { id: 'dim.auto', icon: 'dimension', size: 'S' },
                  ],
                },
              ]
            : ui.tool === 'object'
              ? [{ title: 'rib.p.objects', items: [{ ...objects, short: 'rib.s.objectOther' }, { id: 'model.import', icon: 'box', size: 'S' }] }]
              : ui.tool === 'stair' || ui.tool === 'railing'
                ? [{ title: 'rib.p.circulation', items: [tool('stair', 'tool.stair', 'stair', 'L'), tool('railing', 'tool.railing', 'railing', 'L')] }]
                : ui.tool === 'room' || ui.tool === 'separator'
                  ? [{ title: 'rib.p.rooms', items: [tool('room', 'tool.room', 'room', 'L'), tool('separator', 'tool.separator', 'split', 'S')] }]
                  : [];
  return [
    {
      id: 'context',
      title: 'rib.tab.context',
      text: name,
      context: true,
      panels: [
        select,
        ...ways,
        { title: typeEdit.length > 0 ? 'rib.p.type' : 'rib.p.properties', items: [...typeEdit, properties] },
      ],
    },
  ];
}

/** The context's own actions on the ribbon (context-menu.ts): what a wall, a door, a room offers. */
export const ELEMENT_ACTIONS = new Set(['flipWall', 'editType', 'toggleOpen', 'flipHinge', 'flipSwing', 'centerOpening', 'addFloor', 'addCeiling', 'distribute', 'section']);

/**
 * The contextual tab, Modify | its kind ("Modificar | Parede"), while something is selected with Select:
 * the selection's own actions first (those of the context menu, by their ids `ctx.<id>`), then the
 * edits that apply to it: the Modify tools when they can take it, the walls' geometry with walls,
 * aligning with two or more, the clipboard, hiding for a while, and the selection's own.
 */
export function contextTab(
  app: App,
  select: RibbonTab['panels'][number],
  tool: (id: ToolId, action: string, icon: RibbonItem['icon'], size: 'L' | 'S', short?: MessageKey) => RibbonItem,
  modify: (kind: ModifyKind, icon: RibbonItem['icon']) => RibbonItem,
): RibbonTab[] {
  const { ui } = app;
  if (ui.tool !== 'select' || ui.selection.size === 0) return [];
  const doc = app.store.get();
  const ids = [...ui.selection];
  const kinds = new Set(ids.map((id) => kindOfId(id)));
  const kind = kinds.size === 1 ? [...kinds][0] : null;
  // Doors and windows are one kind: named by what they are ("Modificar | Porta" said it of windows).
  const openings = ids.map((id) => doc.openings.find((o) => o.id === id));
  const allOpenings = openings.every((o) => o !== undefined);
  const what = allOpenings
    ? ids.length === 1
      ? t(openings[0]!.kind === 'door' ? 'panel.door' : 'panel.window')
      : t('panel.openings', { n: ids.length })
    : kind
      ? ids.length === 1
        ? t(kind.one)
        : t(kind.many, { n: ids.length })
      : t('rib.tab.contextMany', { n: ids.length });
  const entries = contextEntries(app, () => app.openCommands());
  // Named short on the ribbon (rib.ctx.<id>); the menu's full name is the button's tip.
  const own = entries.filter((e) => ELEMENT_ACTIONS.has(e.id)).map((e): RibbonItem => ({ id: `ctx.${e.id}`, icon: e.icon, size: 'S', short: `rib.ctx.${e.id}` as MessageKey }));
  const walls = ids.some((id) => doc.walls.some((w) => w.id === id));
  const rooms = ids.some((id) => doc.rooms.some((r) => r.id === id));
  const movable = entries.some((e) => e.id === 'move');
  return [
    {
      id: 'context',
      title: 'rib.tab.context',
      text: t('rib.tab.contextOf', { what }),
      context: true,
      panels: [
        select,
        { title: 'rib.p.properties', items: [{ id: 'settings.panel', icon: 'panel', size: 'L', short: 'rib.s.properties', pressed: () => !app.shell.panel.hidden }] },
        // Rooms selected: a zone made of them.
        ...(own.length > 0 || rooms ? [{ title: 'rib.p.element' as MessageKey, items: [...own, ...(rooms ? [{ id: 'zone.make', icon: 'tag', size: 'S' } as RibbonItem] : [])] }] : []),
        ...(movable
          ? [
              {
                title: 'rib.p.modify' as MessageKey,
                items: [modify('move', 'move'), { ...modify('copy', 'copy'), short: 'rib.s.duplicate' as MessageKey }, modify('rotate', 'rotate'), modify('mirror', 'mirror'), modify('scale', 'scale'), ...(walls ? [modify('offset', 'offset')] : [])],
              },
            ]
          : []),
        ...(walls ? [{ title: 'rib.p.geometry' as MessageKey, items: [tool('split', 'edit.split', 'split', 'S'), tool('corner', 'edit.corner', 'corner', 'S'), { id: 'edit.merge', icon: 'merge', size: 'S' } as RibbonItem] }] : []),
        ...(ids.length > 1
          ? [
              {
                title: 'rib.p.arrange' as MessageKey,
                items: (['left', 'centerX', 'right', 'top', 'centerY', 'bottom', 'spreadX', 'spreadY'] as const).map(
                  (k): RibbonItem => ({ id: `arrange.${k}`, icon: ({ left: 'alignLeft', centerX: 'alignCenterX', right: 'alignRight', top: 'alignTop', centerY: 'alignCenterY', bottom: 'alignBottom', spreadX: 'distribute', spreadY: 'distributeY' } as const)[k], size: 'S' }),
                ),
              },
            ]
          : []),
        { title: 'rib.p.clipboard', items: [{ id: 'edit.copyClip', icon: 'copy', size: 'L' }, { id: 'edit.paste', icon: 'plus', size: 'S' }] },
        { title: 'rib.p.visibility', items: [{ id: 'view.tempHide', icon: 'flip', size: 'S' }, { id: 'view.tempIsolate', icon: 'center', size: 'S' }, { id: 'view.tempReset', icon: 'close', size: 'S' }] },
        { title: 'rib.p.selection', items: [{ id: 'edit.selectSimilar', icon: 'zoomSel', size: 'S' }, { id: 'view.frameSelection', icon: 'zoomSel', size: 'S' }, { id: 'edit.delete', icon: 'trash', size: 'S' }] },
      ],
    },
  ];
}
