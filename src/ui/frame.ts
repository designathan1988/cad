// One frame of the views: the plan's overlay (selection, previews, snaps, tags, temporary dimensions and their value fields) or the 3D's, and the panel. Functions over the app (app.ts delegates).

import { applyCovered, keepSelectionInView3d, keepSelectionInView } from '../session/view-ui';
import { distance } from '../model/vector';
import { resetWallsToType, setWalls, updateWalls } from '../elements/wall/commands';
import { alignHeads, alignOpenings, distributeOpenings, ruleKeepingPosition, setGroupSpacing, ungroupOpenings, updateOpening } from '../elements/opening/commands';
import { GROUP_PREFIX } from '../elements/opening/schema';
import { alignWalls, distributeWalls } from '../elements/wall/arrange';
import { toolCursor } from './cursors';
import { getLang, t } from '../i18n/messages';
import { renderPanel } from './panel';
import { bulgeKeepingSide } from '../elements/wall/arc-edit';
import { kindOfKey, KINDS } from '../elements/registry';
import { levelOf, wallNumber } from '../project/doc';
import { stackedSteps } from '../session/stacked';
import { changeReferenceLine, changeWallType, moveWalls, roomFace } from '../elements/wall/edit';
import { insideRing } from '../elements/room/derive';
import { loadPrefs, savePrefs } from '../project/persist';
import { newId } from '../core/id';
import { clearFloorHoles, setFloorLayers, setFloorTiling, updateFloor, updateRoom, updateRooms } from '../elements/room/commands';
import { type App } from '../session/app';
import { nextFields, type NextSlot } from '../session/next';
import { lowerFirst } from './ribbon-context-tabs';
import { words } from '../elements/object/fields';
import { drawPlanOverlay } from './plan-overlay';
import { currentDims, placeDims } from './temp-dims';
import { renderBrowserDrawer } from './chrome';
import { addInteriorElevations } from '../session/section-tools';
import { startCalibration } from './reference-tool';
import { startFloorHole } from '../session/room-tool';
import * as appPlacing from '../session/app-placing';
import * as appSettings from '../session/app-settings';
import * as appView from '../session/app-view';
import { wallsIn } from '../elements/wall/schema';

/** The panel's title over a placing tool's next element: its kind's name, an object's its own. */
function nextTitle(app: App, slot: NextSlot): string {
  if (slot === 'ceilings') return t('panel.nextCeiling');
  const def = slot === 'objects' ? app.store.get().definitions.find((d) => d.id === app.ui.objectDef) : undefined;
  // An object by its name, the others by their kind's.
  const what = def ? words(def.name) : t(kindOfKey(slot).one);
  return t('panel.nextElement', { what: lowerFirst(what) });
}

export function renderFrame(app: App): void {
  const { ui, shell } = app;
  const plan = ui.view === 'plan';
  // The point under a pointer that has not moved changes with the view (Home, F, the keys, a drawer):
  // taken again, so the footer's coordinates and a floor outline's last side follow it.
  if (app.pointer) ui.cursor = appView.pointerWorld(app);
  // On narrow screens the panel is a drawer over the drawing: it opens only when it has something
  // to show, so it never covers the model for nothing. Set first: what it covers shapes the view.
  const narrow = matchMedia('(max-width: 900px)').matches;
  // On narrow screens the project browser and the panel are both drawers over the drawing: while the
  // browser is open the panel waits, so the drawing keeps the most room.
  const waits = narrow && ((ui.selection.size === 0 && ui.tool === 'select') || ui.browserOpen);
  // Shown by its button while it waits, until it has something to show: then the rule above is back.
  if (!waits) ui.panelPeek = false;
  shell.panel.hidden = !ui.panelOpen || (waits && !ui.panelPeek);
  shell.planCanvas.classList.toggle('hidden', !plan);
  shell.glCanvas.classList.toggle('hidden', plan);
  app.cube.root.hidden = plan;
  // The view's corner (the cube, the views' box) and the 3D view's centre stay in the part of the viewport the panel leaves free.
  const cover = applyCovered(app);
  shell.viewCorner.style.right = `${20 + cover.right}px`;
  drawPlanOverlay(app);
  app.overlay3d.canvas.classList.toggle('hidden', plan);
  shell.viewport.style.cursor = toolCursor(ui.tool);
  app.mark(plan ? 'plan' : '3d');
  placeDims(app, plan ? currentDims(app) : [])
  app.mark('dims');
  renderBrowserDrawer(app);
  app.mark('browser');
  app.renderChrome();
  app.mark('chrome');
  // The panel is rebuilt only when what it shows changed: rebuilding on every mouse move would
  // close an open list and drop the focus of a field being typed in.
  const doc = app.store.get();
  const openingKey = JSON.stringify([ui.openingDefaults, app.geometry.openingWarnings, app.selectedOpenings().map((o) => [o.start, o.end])]);
  // A placing tool's next element (next-element.ts): its fields, and what they show.
  const next = ui.selection.size === 0 ? nextFields(app) : null;
  const panelKey = [ui.tool, ui.levelId, [...ui.selection].sort().join(','), getLang(), JSON.stringify(ui.defaults), JSON.stringify(app.geometry.warnings), openingKey, next?.key ?? ''].join('|');
  const placing = app.openingKind();
  if (doc === app.panelDoc && panelKey === app.panelKey) return afterPanel(app);
  app.panelDoc = doc;
  app.panelKey = panelKey;
  renderPanel(
    shell.panel,
    {
      doc,
      collisions: ui.collisions,
      selected: app.selectedWalls(),
      drawing: ui.tool === 'wall',
      defaults: ui.defaults,
      warnings: app.geometry.warnings,
      openings: app.selectedWalls().length === 0 ? app.selectedOpenings() : [],
      levelRooms: [...app.geometry.rooms.values()].filter((r) => r.room.levelId === ui.levelId),
      placed: app.geometry.openings,
      openingWarnings: app.geometry.openingWarnings,
      openingTool: placing ? { kind: placing, size: ui.openingDefaults[placing], sides: appPlacing.placeSideFields(app, placing) } : null,
      next: next ? { icon: kindOfKey(next.slot === 'ceilings' ? 'floors' : next.slot).icon, title: nextTitle(app, next.slot), fields: next.fields, items: next.items } : null,
      total: ui.selection.size,
      // The first registry kind with a selected element, and those of its elements, as derived.
      kind: (() => {
        for (const k of KINDS) {
          const items = [...(app.geometry.kinds.get(k.key) ?? new Map()).entries()].filter(([id]) => ui.selection.has(id)).map(([, x]) => x);
          if (items.length > 0) return { kind: k, items };
        }
        return null;
      })(),
      stacked: stackedSteps(doc),
      ...(() => {
        const level = levelOf(doc, ui.levelId);
        return level ? { level } : {};
      })(),
    },
    {
      updateWalls: (patch) => app.store.dispatch(updateWalls(wallsIn(app.store.get().walls, ui.selection), patch)),
      setReferenceLine: (line) => {
        const ids = app.selectedWalls().map((w) => w.id);
        app.store.dispatch(setWalls(changeReferenceLine(app.store.get(), ids, line), 'cmd.referenceLine'));
      },
      setWallType: (typeId) => {
        const doc = app.store.get();
        const ids = app.selectedWalls().map((w) => w.id);
        // The rooms as they are now, before the walls move: the face each wall has against one stays.
        const rooms = [...app.geometry.rooms.values()].filter((r) => r.enclosed);
        const inRoom = (levelId: string, p: { x: number; y: number }) => rooms.some((r) => r.room.levelId === levelId && insideRing(r.outline, p));
        const keep = loadPrefs().keepClear !== false;
        app.store.dispatch(setWalls(changeWallType(doc, ids, typeId, (w) => (keep ? roomFace(doc, w, inRoom) : null)), 'cmd.wallType'));
      },
      keepClear: loadPrefs().keepClear !== false,
      setKeepClear: (on) => {
        savePrefs({ keepClear: on });
        app.render();
      },
      resetToType: (fields) => app.store.dispatch(resetWallsToType(wallsIn(app.store.get().walls, ui.selection), fields)),
      editType: () => app.openWallTypes(app.store.get().walls.find((w) => ui.selection.has(w.id))?.wallTypeId),
      updateRadius: (radius) => {
        const w = app.store.get().walls.find((x) => ui.selection.has(x.id));
        const bulge = w?.bulge ? bulgeKeepingSide(distance(w.start, w.end), w.bulge, radius) : null;
        if (w && bulge !== null) app.store.dispatch(updateWalls([w.id], { bulge }));
      },
      setEndJoin: (end, join) => {
        const w = app.store.get().walls.find((x) => ui.selection.has(x.id));
        if (!w) return;
        const joins = { ...w.joins, [end]: join === 'auto' ? undefined : join };
        // An end back to automatic is left out; a wall with neither end chosen has no `joins`.
        const kept = Object.fromEntries(Object.entries(joins).filter(([, v]) => v !== undefined));
        app.store.dispatch(setWalls(app.store.get().walls.map((x) => (x.id === w.id ? (Object.keys(kept).length > 0 ? { ...x, joins: kept } : (({ joins: _j, ...rest }) => rest)(x)) : x)), 'cmd.setEndJoin'));
      },
      arrangeWalls: (how) => {
        // In the order they were picked: the first is the reference.
        const ids = [...ui.selection].filter((id) => app.store.get().walls.some((w) => w.id === id));
        const walls = how === 'align' ? alignWalls(app.store.get(), ids) : distributeWalls(app.store.get(), ids);
        if (walls) app.store.dispatch(setWalls(walls, how === 'align' ? 'cmd.alignWalls' : 'cmd.distributeWalls'));
      },
      ...(() => {
        const ws = app.selectedWalls();
        if (ws.length !== 1) return {};
        const { start, end } = ws[0]!;
        const [dx, dy] = [end.x - start.x, end.y - start.y];
        type Side = 'top' | 'bottom' | 'left' | 'right';
        const sides: [Side, Side] = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? ['left', 'right'] : ['right', 'left']) : dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
        return { endSides: sides };
      })(),
      ...(() => {
        const first = [...ui.selection].find((id) => app.store.get().walls.some((w) => w.id === id));
        const n = first ? wallNumber(app.store.get(), first) : null;
        return n !== null ? { firstWall: t('wall.tag', { n }) } : {};
      })(),
      updateDefaults: (patch) => {
        ui.defaults = { ...ui.defaults, ...patch };
        app.refresh();
      },
      close: () => appSettings.togglePanel(app, false),
      openSection: (id) => app.openSections(id),
      interiorElevations: (ids) => addInteriorElevations(app, ids),
      calibrate: (id) => startCalibration(app, id),
      geometry: app.geometry,
      room: {
        updateRoom: (id, patch) => app.store.dispatch(updateRoom(id, patch)),
        updateRooms: (ids, patch) => app.store.dispatch(updateRooms(ids, patch)),
        levelHeight: (levelId) => levelOf(app.store.get(), levelId)?.height ?? 0,
        startFloorHole: (id) => startFloorHole(app, id),
        clearFloorHoles: (ids) => app.store.dispatch(clearFloorHoles(ids)),
        materials: () => app.store.get().materials,
        setFloorLayers: (ids, layers) => app.store.dispatch(setFloorLayers(ids, layers)),
        setFloorTiling: (ids, tiling) => app.store.dispatch(setFloorTiling(ids, tiling)),
        updateFloor: (ids, patch) => {
          const doc = app.store.get();
          const next = ids.reduce((d, id) => updateFloor(id, patch).apply(d), doc);
          if (next !== doc) app.store.dispatch({ label: 'cmd.updateFloor', apply: () => next });
        },
      },
      opening: {
        update: (ids, patch) => {
          // One command for the whole selection: one undo step.
          const doc = app.store.get();
          // A patch made per opening (its own style changed in one property) or the same for all.
          const next = ids.reduce((d, id) => {
            const o = d.openings.find((x) => x.id === id);
            return o ? updateOpening(id, typeof patch === 'function' ? patch(o) : patch).apply(d) : d;
          }, doc);
          if (next !== doc) app.store.dispatch({ label: 'cmd.updateOpening', apply: () => next });
        },
        setRule: (id, kind, referenceId) => {
          const rule = ruleKeepingPosition(app.store.get(), id, kind, referenceId);
          if (rule) app.store.dispatch(updateOpening(id, { rule }));
        },
        align: (refId, ids, edge) => app.store.dispatch(alignOpenings(refId, ids, edge)),
        alignHeads: (refId, ids) => app.store.dispatch(alignHeads(refId, ids)),
        distribute: (ids, spacing) => app.store.dispatch(distributeOpenings(newId(GROUP_PREFIX), ids, spacing)),
        setSpacing: (groupId, spacing) => app.store.dispatch(setGroupSpacing(groupId, spacing)),
        ungroup: (groupId) => app.store.dispatch(ungroupOpenings(groupId)),
      },
      updateOpeningDefaults: (kind, patch) => {
        ui.openingDefaults = { ...ui.openingDefaults, [kind]: { ...ui.openingDefaults[kind], ...patch } };
        app.refresh();
      },
      dispatch: (c) => app.store.dispatch(c),
      // The wall moved across, with its joins kept as a move keeps them: the face then meets the one below.
      openLevels: () => app.openLevels(),
      alignBelow: (step) => app.store.dispatch(setWalls(moveWalls(app.store.get(), [step.upperId], step.shift), 'cmd.alignBelow')),
    },
  );
  afterPanel(app);
}

/**
 * After the panel has its content: a new selection the panel would hide (sheet or drawer over the
 * plan) brings the plan into view, and the plan is drawn again where it now is.
 */
export function afterPanel(app: App): void {
  if (app.ui.view === 'plan' && keepSelectionInView(app)) app.render();
  else if (app.ui.view === '3d' && keepSelectionInView3d(app)) app.render();
}
