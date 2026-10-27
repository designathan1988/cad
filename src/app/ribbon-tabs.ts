// What the ribbon holds (ui/ribbon.ts), by tab, as in the interface model: Architecture, Annotate,
// Modify, View and Manage, and the File menu. Only actions the app has (app/actions.ts); what is built
// later gets a place here when it gets its action. Pressed states read the app's own.

import { words } from '../elements/object/fields';
import type { ObjectDefinition } from '../elements/object/schema';
import type { RibbonItem, RibbonTab } from '../ui/ribbon';
import type { MessageKey } from '../ui/i18n';
import type { App } from './app';
import type { ModifyKind } from '../tools/modify-tool';
import type { ToolId } from '../ui/shell';

/** Every button with its short name (rib.s.<action>): the palette's full name stays its tooltip. */
export function ribbonTabs(app: App): readonly RibbonTab[] {
  return tabsOf(app).map((tab) => ({
    ...tab,
    panels: tab.panels.map((p) => ({ ...p, items: p.items.map((i) => (i.text ? i : { ...i, short: i.short ?? (`rib.s.${i.id}` as MessageKey) })) })),
  }));
}

/** At most this many objects on the ribbon: the rest are in the objects dialog, which places them too. */
export const RIBBON_OBJECTS = 8;

/**
 * The objects the ribbon shows, in the library's order: the one being placed and those the project has
 * placed first, then the library's first ones up to RIBBON_OBJECTS. A long library no longer pushes the
 * other panels out of sight.
 */
export function ribbonObjects(app: Pick<App, 'store' | 'ui'>): readonly ObjectDefinition[] {
  const doc = app.store.get();
  const wanted = new Set<string>();
  if (app.ui.tool === 'object' && app.ui.objectDef) wanted.add(app.ui.objectDef);
  for (const o of doc.objects) if (wanted.size < RIBBON_OBJECTS) wanted.add(o.definitionId);
  for (const d of doc.definitions) if (wanted.size < RIBBON_OBJECTS) wanted.add(d.id);
  return doc.definitions.filter((d) => wanted.has(d.id));
}

function tabsOf(app: App): readonly RibbonTab[] {
  const { ui } = app;
  const tool = (id: ToolId, action: string, icon: RibbonItem['icon'], size: 'L' | 'S', short?: MessageKey): RibbonItem => ({
    id: action,
    icon,
    size,
    pressed: () => ui.tool === id,
    ...(short ? { short } : {}),
  });
  const modify = (kind: ModifyKind, icon: RibbonItem['icon']): RibbonItem => ({
    id: `edit.${kind}`,
    icon,
    size: 'S',
    pressed: () => ui.tool === 'modify' && ui.modify?.kind === kind,
    explains: true,
  });
  const select = { title: 'rib.p.select' as const, items: [tool('select', 'tool.select', 'pointer', 'L')] };
  return [
    {
      id: 'arch',
      title: 'rib.tab.arch',
      panels: [
        select,
        {
          title: 'rib.p.build',
          items: [
            tool('wall', 'tool.wall', 'wall', 'L'),
            tool('door', 'tool.door', 'door', 'L'),
            tool('window', 'tool.window', 'window', 'L'),
            tool('column', 'tool.column', 'column', 'S'),
            tool('beam', 'tool.beam', 'beam', 'S'),
            tool('curtain', 'tool.curtain', 'window', 'S'),
            tool('floor', 'tool.floor', 'slab', 'S'),
            tool('roof', 'tool.roof', 'roof', 'S'),
            { id: 'tool.rectWall', icon: 'wall', size: 'S' },
            { id: 'tool.arcWall', icon: 'radius', size: 'S' },
          ],
        },
        { title: 'rib.p.circulation', items: [tool('stair', 'tool.stair', 'stair', 'L'), tool('railing', 'tool.railing', 'railing', 'S')] },
        {
          title: 'rib.p.objects',
          items: [
            ...ribbonObjects(app).map(
              (d): RibbonItem => ({ id: `tool.object.${d.id}`, icon: 'box', size: 'S', text: words(d.name), pressed: () => ui.tool === 'object' && ui.objectDef === d.id }),
            ),
            { id: 'objects.edit', icon: 'plus', size: 'S', short: 'rib.s.objectsMore' },
            { id: 'model.import', icon: 'box', size: 'S' },
          ],
        },
        { title: 'rib.p.rooms', items: [tool('room', 'tool.room', 'room', 'L'), tool('separator', 'tool.separator', 'split', 'S'), { id: 'zone.make', icon: 'tag', size: 'S' }] },
        {
          title: 'rib.p.reference',
          items: [
            tool('grid', 'tool.grid', 'hash', 'S'),
            { id: 'level.edit', icon: 'levelsAll', size: 'S' },
            { id: 'edit.clearGuides', icon: 'guide', size: 'S' },
            { id: 'tool.guideLine', icon: 'guide', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'line' },
            { id: 'tool.guidePoint', icon: 'center', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'point' },
            { id: 'tool.guideCircle', icon: 'radius', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'circle' },
            { id: 'ref.import', icon: 'map', size: 'S' },
            { id: 'terrain.add', icon: 'map', size: 'S' },
          ],
        },
      ],
    },
    {
      id: 'annotate',
      title: 'rib.tab.annotate',
      panels: [
        select,
        { title: 'rib.p.dims', items: [tool('dimension', 'tool.dimension', 'dimension', 'L'), { id: 'dim.auto', icon: 'dimension', size: 'S' }, tool('measure', 'tool.measure', 'ruler', 'L')] },
        { title: 'rib.p.text', items: [tool('note', 'edit.addNote', 'text', 'L'), tool('callout', 'tool.callout', 'text', 'S'), tool('levelMark', 'edit.addLevelMark', 'height', 'S')] },
        { title: 'rib.p.tags', items: [{ id: 'settings.openingTags', icon: 'tag', size: 'S', pressed: () => ui.openingTags }] },
        {
          title: 'rib.p.documents',
          items: [
            tool('section', 'tool.section', 'cut', 'L'),
            { id: 'section.elevations', icon: 'cube', size: 'S' },
            { id: 'view.sections', icon: 'cut', size: 'S' },
            { id: 'view.sheets', icon: 'frame', size: 'L' },
          ],
        },
      ],
    },
    {
      id: 'modify',
      title: 'rib.tab.modify',
      panels: [
        select,
        {
          title: 'rib.p.modify',
          items: [modify('move', 'move'), modify('copy', 'copy'), modify('rotate', 'rotate'), modify('mirror', 'mirror'), modify('scale', 'scale'), modify('offset', 'offset')],
        },
        {
          title: 'rib.p.walls',
          items: [tool('split', 'edit.split', 'split', 'S'), tool('corner', 'edit.corner', 'corner', 'S'), { id: 'edit.merge', icon: 'merge', size: 'S' }],
        },
        {
          title: 'rib.p.arrange',
          items: [
            { id: 'arrange.left', icon: 'alignLeft', size: 'S' },
            { id: 'arrange.centerX', icon: 'alignCenterX', size: 'S' },
            { id: 'arrange.right', icon: 'alignRight', size: 'S' },
            { id: 'arrange.top', icon: 'alignTop', size: 'S' },
            { id: 'arrange.centerY', icon: 'alignCenterY', size: 'S' },
            { id: 'arrange.bottom', icon: 'alignBottom', size: 'S' },
            { id: 'arrange.spreadX', icon: 'distribute', size: 'S' },
            { id: 'arrange.spreadY', icon: 'distributeY', size: 'S' },
          ],
        },
        { title: 'rib.p.clipboard', items: [{ id: 'edit.copyClip', icon: 'copy', size: 'S' }, { id: 'edit.paste', icon: 'plus', size: 'S' }] },
        {
          title: 'rib.p.selection',
          items: [{ id: 'edit.selectAll', icon: 'pointer', size: 'S' }, { id: 'edit.selectSimilar', icon: 'zoomSel', size: 'S' }, { id: 'edit.delete', icon: 'trash', size: 'S' }],
        },
      ],
    },
    {
      id: 'view',
      title: 'rib.tab.view',
      panels: [
        {
          title: 'rib.p.views',
          items: [
            { id: 'view.plan', icon: 'map', size: 'L', pressed: () => ui.view === 'plan' && app.walker === null },
            { id: 'view.3d', icon: 'cube', size: 'L', pressed: () => ui.view === '3d' && app.walker === null },
            { id: 'view.walk', icon: 'walk', size: 'L', pressed: () => app.walker !== null },
          ],
        },
        { title: 'rib.p.navigate', items: [{ id: 'view.frameAll', icon: 'frame', size: 'S' }, { id: 'view.frameSelection', icon: 'zoomSel', size: 'S' }] },
        {
          title: 'rib.p.saved',
          items: [{ id: 'view.save', icon: 'plus', size: 'S' }, { id: 'view.tourEdit', icon: 'play', size: 'S' }, { id: 'view.points', icon: 'pin', size: 'S' }, { id: 'site.edit', icon: 'sun', size: 'S' }, { id: 'view.image', icon: 'download', size: 'S' }],
        },
        {
          title: 'rib.p.elevations',
          items: [
            { id: 'view.elevation.north', icon: 'arrowUp', size: 'S' },
            { id: 'view.elevation.south', icon: 'arrowDown', size: 'S' },
            { id: 'view.elevation.east', icon: 'chevronRight', size: 'S' },
            { id: 'view.elevation.west', icon: 'chevronLeft', size: 'S' },
            { id: 'view.section', icon: 'cut', size: 'S' },
            { id: 'view.sectionOff', icon: 'close', size: 'S' },
          ],
        },
        {
          title: 'rib.p.visibility',
          items: [
            { id: 'view.tempHide', icon: 'flip', size: 'S' },
            { id: 'view.tempIsolate', icon: 'center', size: 'S' },
            { id: 'view.tempReset', icon: 'close', size: 'S' },
            { id: 'settings.refLines', icon: 'refCenter', size: 'S', pressed: () => ui.refLines },
          ],
        },
        {
          title: 'rib.p.panels',
          items: [
            { id: 'settings.browser', icon: 'sidebar', size: 'S', pressed: () => ui.browserOpen },
            { id: 'settings.panel', icon: 'panel', size: 'S', pressed: () => !app.shell.panel.hidden },
          ],
        },
      ],
    },
    {
      id: 'manage',
      title: 'rib.tab.manage',
      panels: [
        {
          title: 'rib.p.settings',
          items: [
            { id: 'material.edit', icon: 'slab', size: 'L' },
            { id: 'objects.edit', icon: 'box', size: 'L' },
            { id: 'type.edit', icon: 'wall', size: 'S' },
            { id: 'units.edit', icon: 'ruler', size: 'S' },
            { id: 'level.edit', icon: 'levelsAll', size: 'S' },
            { id: 'drawing.edit', icon: 'scale', size: 'S' },
            { id: 'settings.variables', icon: 'hash', size: 'S' },
          ],
        },
        { title: 'rib.p.project', items: [{ id: 'file.projects', icon: 'folder', size: 'L' }, { id: 'view.schedules', icon: 'table', size: 'S' }, { id: 'rules.edit', icon: 'warning', size: 'S' }, { id: 'lot.edit', icon: 'map', size: 'S' }, { id: 'rules.report', icon: 'download', size: 'S' }] },
        {
          title: 'rib.p.export',
          items: [
            { id: 'file.printPlan', icon: 'map', size: 'L' },
            { id: 'file.exportGlb', icon: 'cube', size: 'S' },
            { id: 'file.exportDxf', icon: 'map', size: 'S' },
            { id: 'file.exportIfc', icon: 'cube', size: 'S' },
            { id: 'file.exportObj', icon: 'cube', size: 'S' },
            { id: 'file.save', icon: 'download', size: 'S' },
          ],
        },
      ],
    },
  ];
}

/** The File menu: the project's files, then help and the interface's settings. */
export const FILE_MENU: readonly (string | '-')[] = [
  'file.new',
  'file.projects',
  'file.open',
  'file.save',
  '-',
  'file.printPlan',
  'file.exportGlb',
  'file.exportDxf',
  'file.exportIfc',
  'file.exportObj',
  'view.schedules',
  '-',
  'settings.language',
  'settings.theme',
  'help.shortcuts',
  'help.tour',
];
