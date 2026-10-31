// What the ribbon holds (ui/ribbon.ts), by tab, as in the interface model (prototype v72): Home, Architecture,
// Structure, Annotate, View, Manage and Edit, and the File menu.
// Only actions the app has (app/actions.ts); what is built
// later gets a place here when it gets its action. Pressed states read the app's own.

import { words } from '../elements/object/fields';
import type { ObjectDefinition } from '../elements/object/schema';
import type { RibbonItem, RibbonTab } from './ribbon';
import type { MessageKey } from '../i18n/messages';
import type { App } from '../session/app';
import type { ModifyKind } from '../session/modify-tool';
import type { ToolId } from './shell';
import { contextTab, placeTab } from './ribbon-context-tabs';
import { ceilingOf } from '../elements/tool-draft';

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
  // A level and the grid, the same in Architecture and Structure.
  const levels: RibbonItem = { id: 'level.edit', icon: 'levelsAll', size: 'S', short: 'rib.s.levelRef' };
  const grid = tool('grid', 'tool.grid', 'hash', 'S');
  // Objects: one button, its list the ones the project uses first (ribbonObjects), the library, an import.
  const objects: RibbonItem = {
    id: 'objects.edit',
    icon: 'box',
    size: 'L',
    short: 'rib.s.objectTool',
    pressed: () => ui.tool === 'object',
    menu: () => [
      ...ribbonObjects(app).map((d): RibbonItem => ({ id: `tool.object.${d.id}`, icon: 'box', size: 'S', text: words(d.name), pressed: () => ui.tool === 'object' && ui.objectDef === d.id })),
      { id: 'objects.edit', icon: 'plus', size: 'S', short: 'rib.s.objectsMore' },
      { id: 'model.import', icon: 'box', size: 'S' },
    ],
  };
  return [
    // Home (as AutoCAD's Home and Office's Página Inicial): the commands used most, from the other tabs,
    // so a day's drawing rarely needs to leave it.
    {
      id: 'home',
      title: 'rib.tab.home',
      panels: [
        select,
        { title: 'rib.p.clipboard', items: [{ id: 'edit.paste', icon: 'plus', size: 'L' }, { id: 'edit.copyClip', icon: 'copy', size: 'S' }] },
        {
          title: 'rib.p.draw',
          items: [
            tool('wall', 'tool.wall', 'wall', 'L'),
            tool('door', 'tool.door', 'door', 'L'),
            tool('window', 'tool.window', 'window', 'L'),
            objects,
            { ...tool('floor', 'tool.floor', 'slab', 'S'), pressed: () => ui.tool === 'floor' && !ceilingOf(ui.draft) },
            tool('roof', 'tool.roof', 'roof', 'S'),
            tool('stair', 'tool.stair', 'stair', 'S'),
            tool('room', 'tool.room', 'room', 'S'),
            tool('column', 'tool.column', 'column', 'S'),
            tool('railing', 'tool.railing', 'railing', 'S'),
          ],
        },
        // The edits of a selection are on its own tab (Modify | …); these two work by clicking a wall.
        { title: 'rib.p.geometry', items: [tool('split', 'edit.split', 'split', 'S'), tool('corner', 'edit.corner', 'corner', 'S')] },
        { title: 'rib.p.annotation', items: [tool('dimension', 'tool.dimension', 'dimension', 'L'), tool('note', 'edit.addNote', 'text', 'S'), tool('measure', 'tool.measure', 'ruler', 'S')] },
        // Plan and 3D are the title bar's switch (shell.ts): here they were a second copy.
        { title: 'rib.p.views', items: [tool('section', 'tool.section', 'cut', 'L')] },
      ],
    },
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
            objects,
            tool('column', 'tool.column', 'column', 'S'),
            { ...tool('floor', 'tool.floor', 'slab', 'S'), pressed: () => ui.tool === 'floor' && !ceilingOf(ui.draft) },
            tool('roof', 'tool.roof', 'roof', 'S'),
            { id: 'tool.ceiling', icon: 'arrowUp', size: 'S', pressed: () => ui.tool === 'floor' && ceilingOf(ui.draft) },
            tool('curtain', 'tool.curtain', 'window', 'S'),
            { id: 'tool.rectWall', icon: 'wall', size: 'S' },
            { id: 'tool.arcWall', icon: 'radius', size: 'S' },
          ],
        },
        { title: 'rib.p.circulation', items: [tool('stair', 'tool.stair', 'stair', 'L'), tool('railing', 'tool.railing', 'railing', 'S')] },
        { title: 'rib.p.rooms', items: [tool('room', 'tool.room', 'room', 'L'), tool('separator', 'tool.separator', 'split', 'S')] },
        {
          title: 'rib.p.reference',
          items: [
            levels,
            grid,
            { id: 'tool.guideLine', icon: 'guide', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'line' },
            { id: 'tool.guidePoint', icon: 'center', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'point' },
            { id: 'tool.guideCircle', icon: 'radius', size: 'S', pressed: () => ui.tool === 'guide' && ui.guideMode === 'circle' },
            { id: 'edit.clearGuides', icon: 'guide', size: 'S' },
          ],
        },
      ],
    },
    {
      id: 'structure',
      title: 'rib.tab.structure',
      panels: [select, { title: 'rib.p.structure', items: [tool('beam', 'tool.beam', 'beam', 'L'), tool('column', 'tool.column', 'column', 'L')] }, { title: 'rib.p.reference', items: [levels, grid] }],
    },
    {
      id: 'annotate',
      title: 'rib.tab.annotate',
      panels: [
        select,
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
        { title: 'rib.p.text', items: [tool('note', 'edit.addNote', 'text', 'L'), tool('callout', 'tool.callout', 'text', 'S')] },
        { title: 'rib.p.tags', items: [{ id: 'settings.openingTags', icon: 'tag', size: 'L', short: 'rib.s.openingTagsShort', pressed: () => ui.openingTags }] },
      ],
    },
    {
      id: 'view',
      title: 'rib.tab.view',
      panels: [
        {
          title: 'rib.p.graphics',
          items: [
            { id: 'view.overrides', icon: 'levelsAll', size: 'L', short: 'rib.s.overrides' },
            { id: 'view.overridesToggle', icon: 'flip', size: 'S', short: 'rib.s.overridesToggle' },
            { id: 'layers.save', icon: 'plus', size: 'S', short: 'rib.s.layersSave' },
            { id: 'settings.refLines', icon: 'refCenter', size: 'S', pressed: () => ui.refLines },
            { id: 'view.tempReset', icon: 'close', size: 'S' },
          ],
        },
        {
          title: 'rib.p.create',
          items: [
            tool('section', 'tool.section', 'cut', 'L'),
            { id: 'section.elevations', icon: 'cube', size: 'S' },
            { id: 'view.sections', icon: 'cut', size: 'S' },
            { id: 'view.save', icon: 'plus', size: 'S' },
          ],
        },
        {
          title: 'rib.p.camera',
          items: [
            { id: 'view.elevation.north', icon: 'arrowUp', size: 'S' },
            { id: 'view.elevation.south', icon: 'arrowDown', size: 'S' },
            { id: 'view.elevation.east', icon: 'chevronRight', size: 'S' },
            { id: 'view.elevation.west', icon: 'chevronLeft', size: 'S' },
            { id: 'view.section', icon: 'cut', size: 'S' },
            { id: 'view.sectionOff', icon: 'close', size: 'S' },
            { id: 'view.frameAll', icon: 'frame', size: 'S' },
            { id: 'view.frameSelection', icon: 'zoomSel', size: 'S' },
          ],
        },
        {
          title: 'rib.p.panels',
          items: [
            { id: 'settings.panel', icon: 'panel', size: 'L', pressed: () => !app.shell.panel.hidden },
            { id: 'settings.browser', icon: 'sidebar', size: 'S', pressed: () => ui.browserOpen },
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
            // One Library for the six catalogs (ui/library-tabs.ts): six buttons for them were here.
            { id: 'library.open', icon: 'box', size: 'L', short: 'lib.title' },
            { id: 'units.edit', icon: 'ruler', size: 'S' },
            { id: 'level.edit', icon: 'levelsAll', size: 'S' },
            { id: 'drawing.edit', icon: 'scale', size: 'S' },
            { id: 'settings.variables', icon: 'hash', size: 'S' },
          ],
        },
        { title: 'rib.p.manageProject', items: [{ id: 'file.projects', icon: 'folder', size: 'L' }, { id: 'ref.import', icon: 'map', size: 'S' }, { id: 'model.import', icon: 'box', size: 'S' }, { id: 'settings.keys', icon: 'hash', size: 'S', short: 'rib.s.keys' }] },
      ],
    },
    // Modify | <what is selected> (Revit's contextual tab): only while something is selected, last.
    ...contextTab(app, select, tool, modify),
    // Place <element> (Revit's Modify | Place …, prototype v7's per-tool tab): while a placing tool is on.
    ...placeTab(app, select, tool, objects),
  ];
}

/** The File menu: the project's files, then help and the interface's settings. */
export const FILE_MENU: readonly (string | '-')[] = [
  'file.new',
  'file.projects',
  'file.open',
  'file.save',
  '-',
  'settings.language',
  'settings.theme',
  'help.shortcuts',
];
