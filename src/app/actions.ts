// Everything the user can do by name: tools, views, editing, files, settings, levels, help. The
// command palette lists these; the toolbar, keys and menus do the same things, with the same names
// and keys (ref/chat.txt:200), because they read them from here.

import { words } from '../elements/object/fields';
import { tBoth, name, t, type MessageKey } from '../ui/i18n';
import type { App } from './app';
import { canTransform } from '../tools/transform';

export interface Action {
  readonly id: string;
  readonly label: string;
  /** Where it lives, shown beside it: tools, views, edit, file, settings, levels, help. */
  readonly group: string;
  /** Words that also find it: its name in the other language. */
  readonly keywords: string;
  readonly keys?: string;
  readonly enabled: boolean;
  readonly run: () => void;
}

/** What only the input layer can open (dialogs, the file picker, the tour). */
export interface Openers {
  readonly help: () => void;
  readonly levels: () => void;
  readonly wallTypes: () => void;
  readonly materials: () => void;
  readonly units: () => void;
  readonly objects: () => void;
  readonly tour: () => void;
  readonly openFile: () => void;
  readonly projects: () => void;
}

export function appActions(app: App, open: Openers): Action[] {
  const { ui, store } = app;
  const doc = store.get();
  const has = ui.selection.size > 0;
  const make = (id: string, key: MessageKey, group: MessageKey, run: () => void, extra: { keys?: string; enabled?: boolean; keywords?: string } = {}): Action => ({
    id,
    label: t(key),
    group: t(group),
    keywords: `${tBoth(key)} ${extra.keywords ?? ''}`.trim(),
    enabled: extra.enabled ?? true,
    run,
    ...(extra.keys ? { keys: extra.keys } : {}),
  });
  const tools = 'pal.group.tools';
  const views = 'pal.group.views';
  const edit = 'pal.group.edit';
  const file = 'pal.group.file';
  const settings = 'pal.group.settings';
  const levels = 'pal.group.levels';
  const help = 'pal.group.help';
  return [
    make('tool.select', 'tool.select', tools, () => app.setTool('select'), { keys: 'V' }),
    make('tool.wall', 'tool.wall', tools, () => app.setTool('wall'), { keys: 'W' }),
    // Q in the wall tool, as A is for the arc: the palette showed no key for it.
    make('tool.rectWall', 'pal.rectWall', tools, () => {
      app.setTool('wall');
      app.wallEvent({ kind: 'rect' });
    }, { keys: 'W, Q' }),
    make('tool.arcWall', 'pal.arcWall', tools, () => {
      app.setTool('wall');
      app.wallEvent({ kind: 'arc' });
    }, { keys: 'W, A' }),
    make('tool.floor', 'tool.floor', tools, () => app.setTool('floor'), { keys: 'L' }),
    make('tool.door', 'tool.door', tools, () => app.setTool('door'), { keys: 'D' }),
    make('tool.window', 'tool.window', tools, () => app.setTool('window'), { keys: 'Shift+W' }),
    make('tool.room', 'tool.room', tools, () => app.setTool('room'), { keys: 'R' }),
    make('tool.measure', 'tool.measure', tools, () => app.setTool('measure'), { keys: 'M' }),
    make('tool.railing', 'tool.railing', tools, () => app.setTool('railing'), { keys: 'G', keywords: 'guarda-corpo guarda corpo corrimão railing guardrail parapeito' }),
    make('tool.stair', 'tool.stair', tools, () => app.setTool('stair'), { keys: 'E', keywords: 'escada escadas stair stairs degrau caracol rampa ramp' }),
    make('tool.roof', 'tool.roof', tools, () => app.setTool('roof'), { keys: 'T', keywords: 'telhado telhados roof cobertura água águas platibanda' }),
    make('tool.beam', 'tool.beam', tools, () => app.setTool('beam'), { keys: 'B', keywords: 'viga vigas beam estrutura structure' }),
    make('tool.column', 'tool.column', tools, () => app.setTool('column'), { keys: 'P', keywords: 'pilar pilares coluna column estrutura structure' }),
    make('tool.grid', 'tool.grid', tools, () => app.setTool('grid'), { keys: 'Shift+G', keywords: 'eixo eixos grade grid axis axes estrutura' }),
    make('tool.dimension', 'tool.dimension', tools, () => app.setTool('dimension'), { keys: 'Shift+D', keywords: 'cota dimension medida permanente' }),
    // One per object definition of the project: placed by the same tool, named by the definition.
    ...doc.definitions.map((d) => ({
      id: `tool.object.${d.id}`,
      label: t('pal.object', { name: words(d.name) }),
      group: t(tools),
      keywords: `${d.name.pt} ${d.name.en} objeto object mobiliário furniture`,
      enabled: true,
      run: () => app.placeObject(d.id),
    })),
    make('view.3d', 'view.3d', views, () => app.setView('3d'), { keys: '1', enabled: ui.view !== '3d' }),
    make('view.plan', 'view.plan', views, () => app.setView('plan'), { keys: '2', enabled: ui.view !== 'plan' }),
    make('view.walk', 'pal.walk', views, () => app.toggleWalk(), { keys: '3' }),
    make('view.frameSelection', 'pal.frameSelection', views, () => app.frameSelection(), { keys: 'F', enabled: has }),
    make('view.frameAll', 'pal.frameAll', views, () => app.frameAll(), { keys: 'Home' }),
    make('view.levelsAll', 'pal.levelsAll', views, () => app.setView3D({ levels: 'all' }), { enabled: ui.view3d.levels !== 'all' }),
    make('view.levelsBelow', 'pal.levelsBelow', views, () => app.setView3D({ levels: 'below' }), { enabled: ui.view3d.levels !== 'below' }),
    make('view.levelsCurrent', 'pal.levelsCurrent', views, () => app.setView3D({ levels: 'current' }), { enabled: ui.view3d.levels !== 'current' }),
    make('view.explode', 'pal.explode', views, () => app.toggleExplode()),
    make('view.cut', 'pal.cut', views, () => app.setView3D({ cut: !ui.view3d.cut })),
    make('view.xray', 'pal.xray', views, () => app.setView3D({ xray: !ui.view3d.xray })),
    make('view.box', 'pal.box', views, () => app.toggleBox()),
    make('view.ortho', 'pal.ortho', views, () => app.setView3D({ ortho: !ui.view3d.ortho })),
    make('view.section', 'pal.section', views, () => app.sectionAtGuide(), { enabled: doc.guides.some((g) => ui.selection.has(g.id)) }),
    make('view.sectionFlip', 'pal.sectionFlip', views, () => app.sectionAtGuide(true), { enabled: doc.guides.some((g) => ui.selection.has(g.id)) }),
    make('view.sectionOff', 'pal.sectionOff', views, () => app.clearSection(), { enabled: ui.view3d.section !== null }),
    ...(['north', 'south', 'east', 'west'] as const).map((side) => make(`view.elevation.${side}`, `pal.elevation.${side}`, views, () => app.elevation(side))),
    make('edit.undo', 'pal.undo', edit, () => app.undo(), { keys: 'Ctrl+Z', enabled: store.canUndo() }),
    make('edit.redo', 'pal.redo', edit, () => app.redo(), { keys: 'Ctrl+Shift+Z', enabled: store.canRedo() }),
    make('edit.delete', 'pal.delete', edit, () => app.deleteSelection(), { keys: 'Del', enabled: has }),
    make('edit.selectAll', 'pal.selectAll', edit, () => app.selectAllWalls(), { keys: 'Ctrl+A' }),
    make('edit.selectSimilar', 'ctx.selectSimilar', edit, () => app.selectSimilar(), { enabled: has, keywords: 'select all instances semelhantes mesmo tipo same type' }),
    make('edit.clearSelection', 'pal.clearSelection', edit, () => app.clearSelection(), { keys: 'Esc', enabled: has }),
    ...(['move', 'copy', 'rotate', 'scale', 'mirror', 'offset'] as const).map((k) =>
      make(`edit.${k}`, `pal.${k}`, edit, () => app.startModify(k), {
        keys: { move: 'Shift+M', copy: 'Shift+C', rotate: 'Shift+R', scale: 'Shift+E', mirror: 'Shift+X', offset: 'Shift+O' }[k],
        enabled: canTransform(doc, [...ui.selection]),
      }),
    ),
    make('edit.copyClip', 'pal.copyClip', edit, () => app.copySelection(), { keys: 'Ctrl+C', enabled: canTransform(doc, [...ui.selection]) }),
    make('edit.paste', 'pal.paste', edit, () => app.paste(), { keys: 'Ctrl+V' }),
    make('edit.split', 'pal.split', edit, () => app.setTool('split'), { keys: 'Shift+S' }),
    make('edit.corner', 'pal.corner', edit, () => app.setTool('corner'), { keys: 'Shift+T' }),
    make('edit.merge', 'pal.merge', edit, () => app.mergeSelection(), { keys: 'Shift+J', enabled: app.canMergeSelection() }),
    make('edit.clearGuides', 'pal.clearGuides', edit, () => app.clearGuides(), { enabled: doc.guides.some((g) => g.levelId === ui.levelId) }),
    make('view.tempHide', 'pal.tempHide', views, () => app.hideTemporarily('hide'), { keys: 'Shift+H', enabled: has }),
    make('view.tempIsolate', 'pal.tempIsolate', views, () => app.hideTemporarily('isolate'), { keys: 'Shift+I', enabled: has }),
    make('view.tempReset', 'pal.tempReset', views, () => app.resetTemporary(), { enabled: ui.temp !== null }),
    make('edit.next', 'pal.stepSelection', edit, () => app.stepSelection(1), { keys: 'N' }),
    make('edit.previous', 'pal.stepBack', edit, () => app.stepSelection(-1), { keys: 'Shift+N' }),
    make('file.projects', 'pal.projects', file, open.projects, { keywords: 'projetos projects lista list abrir open biblioteca library' }),
    make('file.new', 'pal.new', file, () => app.newProject()),
    make('file.open', 'pal.open', file, open.openFile, { keys: 'Ctrl+O' }),
    make('file.save', 'pal.save', file, () => app.saveFile(), { keys: 'Ctrl+S' }),
    make('file.exportGlb', 'export.glb', file, () => void app.exportGlb(), { keywords: 'GLB glTF 3D export exportar modelo' }),
    make('file.exportDxf', 'export.dxf', file, () => app.exportDxf(), { keywords: 'DXF CAD AutoCAD planta plan export exportar' }),
    make('settings.snaps', 'pal.snaps', settings, () => app.toggleSnaps(), { keys: 'S' }),
    make('settings.theme', 'pal.theme', settings, () => app.toggleTheme()),
    make('settings.language', 'pal.language', settings, () => app.setLanguage(app.otherLanguage()), { keys: 'Shift+L', keywords: 'English Português' }),
    make('settings.panel', 'pal.panel', settings, () => app.togglePanel()),
    make('settings.browser', 'pal.browser', settings, () => app.toggleBrowser()),
    make('settings.refLines', 'pal.refLines', settings, () => app.toggleRefLines()),
    make('settings.debug', 'debug.pal', settings, () => app.toggleDebug(), { keys: 'F7', keywords: 'debug diagnóstico diagnostics erros errors problemas' }),
    make('settings.openingTags', 'pal.openingTags', settings, () => app.toggleOpeningTags(), { keywords: 'etiquetas tags marks tipo type portas janelas doors windows' }),
    ...(['walls', 'openings', 'rooms', 'floors', 'objects', 'guides'] as const).map((c) =>
      make(`layer.${c}`, ui.hidden.has(c) ? (`pal.show.${c}` as const) : (`pal.hide.${c}` as const), settings, () => app.toggleCategory(c)),
    ),
    ...[...doc.levels]
      .sort((a, b) => b.elevation - a.elevation)
      .map((l) => ({
        id: `level.${l.id}`,
        label: t('pal.goLevel', { name: name(l.name) }),
        group: t(levels),
        // Either language's command, with the stored name and the shown one.
        keywords: `${tBoth('pal.goLevel', { name: l.name })} ${name(l.name)}`,
        enabled: l.id !== ui.levelId,
        run: () => app.setLevel(l.id),
      })),
    make('view.save', 'views.save', views, () => app.saveCurrentView()),
    make('view.tourEdit', 'gtour.edit', views, () => app.openTour()),
    make('view.points', 'poi.dialogOpen', views, () => app.openPoints()),
    make('view.schedules', 'schedule.open', views, () => app.openSchedules(), { keywords: 'schedule quantitativos tabela CSV portas janelas cômodos paredes áreas' }),
    make('view.addPoint', 'pal.addPoint', views, () => app.addPointHere()),
    make('edit.addNote', 'ctx.addNote', edit, () => app.addNoteHere(), { keywords: 'texto text nota note anotação annotation' }),
    make('edit.addLevelMark', 'ctx.addLevelMark', edit, () => app.addLevelMarkHere(), { keywords: 'cota de nível level mark elevation altura spot' }),
    make('view.tourPlay', 'gtour.play', views, () => app.playTour(), { enabled: doc.views.length > 0 }),
    ...doc.views.map((v) => ({
      id: `view.go.${v.id}`,
      label: t('pal.goView', { name: name(v.name) }),
      group: t(views),
      keywords: `${tBoth('pal.goView', { name: v.name })} ${name(v.name)}`,
      enabled: true,
      run: () => app.goToView(v.id),
    })),
    make('level.edit', 'levels.edit', levels, open.levels),
    make('type.edit', 'types.edit', edit, open.wallTypes, { keywords: tBoth('types.title') }),
    make('material.edit', 'mats.edit', edit, open.materials, { keywords: tBoth('mats.title') }),
    make('objects.edit', 'objs.open', edit, open.objects, { keywords: `${tBoth('objs.title')} biblioteca library família family editor` }),
    make('units.edit', 'units.edit', edit, open.units, { keywords: `${tBoth('units.title')} ${tBoth('units.cm')} ${tBoth('units.mm')}` }),
    make('help.shortcuts', 'pal.shortcuts', help, open.help, { keys: '?' }),
    make('help.tour', 'pal.tour', help, open.tour),
  ];
}
