// Everything the user can do by name: tools, views, editing, files, settings, levels, help. The
// command palette lists these; the toolbar, keys and menus do the same things, with the same names
// and keys (ref/chat.txt:200), because they read them from here.

import { keyOf } from './keymap';
import { ARRANGE_HOWS, arrangeNeeds } from '../tools/arrange';
import { newId } from '../core/id';
import { addZone } from '../elements/zone/commands';
import { ZONE_COLOURS, ZONE_PREFIX } from '../elements/zone/schema';
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
  /** Its key now: its own, or the one the user gave it (app/keymap.ts); none when turned off. */
  readonly keys?: string;
  /** Its own key, whatever the user made of it. */
  readonly defaultKeys?: string;
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
  readonly print: () => void;
  readonly drawing: () => void;
  readonly keys: () => void;
  readonly variables: () => void;
}

export function appActions(app: App, open: Openers): Action[] {
  const { ui, store } = app;
  const doc = store.get();
  const has = ui.selection.size > 0;
  const make = (id: string, key: MessageKey, group: MessageKey, run: () => void, extra: { keys?: string; enabled?: boolean; keywords?: string } = {}): Action => {
    const keys = keyOf(id, extra.keys, app.keymap);
    return {
      id,
      label: t(key),
      group: t(group),
      keywords: `${tBoth(key)} ${extra.keywords ?? ''}`.trim(),
      enabled: extra.enabled ?? true,
      run,
      ...(keys ? { keys } : {}),
      ...(extra.keys ? { defaultKeys: extra.keys } : {}),
    };
  };
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
    make('tool.separator', 'tool.separator', tools, () => app.setTool('separator'), { keywords: 'separador separação cômodo ambiente room separation line' }),
    make('tool.curtain', 'tool.curtain', tools, () => app.setTool('curtain'), { keywords: 'parede-cortina pele de vidro fachada curtain wall glazing facade montante caixilho' }),
    make('tool.guideLine', 'tool.guideLine', tools, () => app.setGuideTool('line'), { keywords: 'guia guide linha line dois pontos two points ângulo angle referência reference' }),
    make('tool.guidePoint', 'tool.guidePoint', tools, () => app.setGuideTool('point'), { keywords: 'guia guide ponto point referência reference' }),
    make('tool.guideCircle', 'tool.guideCircle', tools, () => app.setGuideTool('circle'), { keywords: 'guia guide círculo circle raio radius referência reference' }),
    make('tool.column', 'tool.column', tools, () => app.setTool('column'), { keys: 'P', keywords: 'pilar pilares coluna column estrutura structure' }),
    make('tool.grid', 'tool.grid', tools, () => app.setTool('grid'), { keys: 'Shift+G', keywords: 'eixo eixos grade grid axis axes estrutura' }),
    make('tool.dimension', 'tool.dimension', tools, () => app.setTool('dimension'), { keys: 'Shift+D', keywords: 'cota dimension medida permanente' }),
    // One per object definition of the project: placed by the same tool, named by the definition.
    ...doc.definitions.map((d) => ({
      id: `tool.object.${d.id}`,
      label: t('pal.object', { name: words(d.name) }),
      group: t(tools),
      // Found by either language's words, "place" as "colocar".
      keywords: `${tBoth('pal.object', { name: words(d.name) })} ${d.name.pt} ${d.name.en} inserir insert objeto object mobiliário furniture`,
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
    // The selected rooms as a zone, named and tinted by its category; selected, to name it in the panel.
    make(
      'zone.make',
      'zone.make',
      tools,
      () => {
        const rooms = doc.rooms.filter((r) => ui.selection.has(r.id));
        const first = rooms[0];
        if (!first) return;
        const id = newId(ZONE_PREFIX);
        store.dispatch(addZone({ id, levelId: first.levelId, name: t('zone.default', { n: doc.zones.length + 1 }), category: 'social', color: ZONE_COLOURS.social, rooms: rooms.filter((r) => r.levelId === first.levelId).map((r) => r.id) }));
        ui.selection = new Set([id]);
        app.showProperties();
        app.refresh();
      },
      { enabled: doc.rooms.some((r) => ui.selection.has(r.id)), keywords: 'zona zonas zone área setor social íntima serviço' },
    ),
    make('view.section', 'pal.section', views, () => app.sectionAtGuide(), { enabled: doc.guides.some((g) => ui.selection.has(g.id) && !g.shape) }),
    make('view.sectionFlip', 'pal.sectionFlip', views, () => app.sectionAtGuide(true), { enabled: doc.guides.some((g) => ui.selection.has(g.id) && !g.shape) }),
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
    make('file.printPlan', 'print.open', file, open.print, { keys: 'Ctrl+P', keywords: 'PDF imprimir print planta plan escala scale papel paper' }),
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
    make('view.sections', 'section.dialogOpen', views, () => app.openSections(), { keywords: 'corte cortes section sections elevação elevações elevation fachada facade' }),
    make('view.sheets', 'sheet.open', views, () => app.openSheets(), { keywords: 'prancha pranchas sheet sheets carimbo title block folha PDF documentação' }),
    make('tool.section', 'tool.section', tools, () => app.setTool('section'), { keywords: 'corte section linha de corte cut line' }),
    make('dim.auto', 'dim.auto', tools, () => app.autoDimension(), { keywords: 'cotagem automática auto dimension cotar paredes cotas fachada exterior' }),
    make('section.elevations', 'section.makeElevations', views, () => app.addElevations(), { keywords: 'elevação elevações elevation fachadas facades norte sul leste oeste' }),
    make('view.addPoint', 'pal.addPoint', views, () => app.addPointHere()),
    // Tools: the text or the level mark goes where the next click is (it went in the middle of the view).
    make('edit.addNote', 'ctx.addNote', edit, () => app.setTool('note'), { keywords: 'texto text nota note anotação annotation' }),
    make('edit.addLevelMark', 'ctx.addLevelMark', edit, () => app.setTool('levelMark'), { keywords: 'cota de nível level mark elevation altura spot' }),
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
    // The norms the model is checked against, and what is outside them.
    make('rules.edit', 'rules.open', edit, () => app.openRules(), { keywords: `${tBoth('rules.title')} norma norm NBR regra rule acessibilidade accessibility escada stair` }),
    make('type.edit', 'types.edit', edit, open.wallTypes, { keywords: tBoth('types.title') }),
    make('material.edit', 'mats.edit', edit, open.materials, { keywords: tBoth('mats.title') }),
    make('objects.edit', 'objs.open', edit, open.objects, { keywords: `${tBoth('objs.title')} biblioteca library família family editor` }),
    make('units.edit', 'units.edit', edit, open.units, { keywords: `${tBoth('units.title')} ${tBoth('units.cm')} ${tBoth('units.mm')}` }),
    ...[2, 3, 4, 5, 6, 8, 10].map((n) =>
      make(`snap.parts.${n}`, 'pal.snapParts', settings, () => app.setSnapParts(n), { enabled: ui.snapParts !== n, keywords: `${n} encaixe snap divisão division terços thirds partes parts` }),
    ).map((a, i) => ({ ...a, label: t('pal.snapParts', { n: [2, 3, 4, 5, 6, 8, 10][i]! }) })),
    // Align and distribute the selection (tools/arrange.ts): enabled when enough of it can.
    ...(() => {
      const n = app.arrangeItems().length;
      return ARRANGE_HOWS.map((how) => make(`arrange.${how}`, `arrange.${how}` as MessageKey, edit, () => app.arrange(how), { enabled: n >= arrangeNeeds(how), keywords: 'alinhar align distribuir distribute organizar arrange' }));
    })(),
    make('settings.variables', 'vars.open', settings, open.variables, { keywords: 'variáveis variables pé-direito módulo module medida measure nome name' }),
    make('view.overrides', 'ovr.open', views, () => app.openOverrides(), { keywords: 'substituição override filtro filter cor color demolir demolish' }),
    make('view.overridesToggle', app.ui.overridesOn ? 'ovr.turnOff' : 'ovr.turnOn', views, () => app.toggleOverrides(), { enabled: (doc.overrides ?? []).length > 0 }),
    make('layers.save', 'layers.save', views, () => app.saveLayerSet(), { keywords: 'camadas layers combinação combination salvar save' }),
    ...(doc.layerSets ?? []).map((s) => ({ ...make(`layers.apply.${s.id}`, 'layers.apply', views, () => app.applyLayerSet(s.id)), label: t('layers.apply', { name: s.name }) })),
    make('settings.keys', 'keys.open', settings, open.keys, { keywords: 'atalhos shortcuts teclado keyboard teclas keys remapear remap desligar' }),
    make('drawing.edit', 'draw.open', edit, open.drawing, { keywords: `${tBoth('draw.title')} 1:50 1:100 pena pen espessura lineweight` }),
    make('help.shortcuts', 'pal.shortcuts', help, open.help, { keys: '?' }),
    make('help.tour', 'pal.tour', help, open.tour),
  ];
}
