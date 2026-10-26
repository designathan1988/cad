// Mouse and keyboard. Plan: wheel zooms at the cursor, middle button pans. 3D: wheel zooms at the
// cursor, middle pans, Shift + middle or right rotates (OrbitControls). Left button is the tool's.

import { type BoxFace, dragDistance, moveFace, type SectionBox } from './section-box';
import type { Point2 } from '../core/vector';
import { snap } from '../tools/snap';
import { t } from '../ui/i18n';
import { el } from '../ui/controls';
import { wallAt } from './geometry';
import { aimAt, OPENING_PREVIEW_ID } from './opening-ui';
import type { App } from './app';
import { levelOf } from './document';
import { selectGestures } from './select-drag';
import { insideRing } from '../elements/room/derive';
import { showLevels } from '../ui/levels-dialog';
import { showTourDialog } from '../ui/tour-dialog';
import { showPointsDialog } from '../ui/points-dialog';
import { showSchedulesDialog } from '../ui/schedules-dialog';
import { watchErrors } from './error-log';
import { showWallTypes } from '../ui/types-dialog';
import { showPalette } from '../ui/palette';
import { offerTour, startTour } from '../ui/tour';
import { appActions, type Openers } from './actions';
import { contextEntries } from './context-menu';
import { showMenu } from '../ui/menu';
import type { WallId } from '../elements/wall/schema';
import { eachSolid } from '../elements/registry';
import type { PickOrder } from '../elements/contract';
import { distance, normalize, sub } from '../core/vector';
import { outerSides } from '../elements/wall/geometry/seams';
import { wireKeys } from './input-keys';
import { wireButtons } from './input-buttons';

/** How near (screen pixels) the pointer must come to a wall, a door or a window to take it. */
const PICK_PX = 6;

export function wireInput(app: App): void {
  const { shell, ui } = app;
  const openers: Openers = {
    help: () => showHelp(app),
    levels: () => showLevels(app),
    wallTypes: () => showWallTypes(app),
    tour: () => startTour(app),
    openFile: () => shell.fileInput.click(),
  };
  const palette = () => showPalette(appActions(app, openers));
  app.openCommands = palette;
  app.openLevels = () => showLevels(app);
  app.openTour = () => showTourDialog(app);
  app.openPoints = () => showPointsDialog(app);
  app.openSchedules = () => showSchedulesDialog(app);
  watchErrors(() => app.debugOpen && app.toggleDebug(true));
  app.openWallTypes = (typeId) => showWallTypes(app, typeId);
  shell.sidebar.addEventListener('click', () => app.toggleBrowser());
  offerTour(app);
  let panning: { x: number; y: number } | null = null;
  let downAt: { x: number; y: number } | null = null;
  let rightAt: { x: number; y: number } | null = null;
  /** The menu for what is under the pointer: it becomes the selection, unless it is already in it. */
  const contextMenu = (e: PointerEvent) => {
    if (ui.error !== null) shell.measure.value = '';
    ui.error = null;
    if (ui.tool !== 'select') app.setTool('select');
    const hit = pickAt(e, worldAt(e));
    if (hit && !ui.selection.has(hit)) ui.selection = new Set([hit]);
    if (!hit) ui.selection.clear();
    app.refresh();
    // Where the menu was opened, for "Walk from here": the pointer leaves the drawing for the menu.
    app.contextPoint = worldAt(e)?.p ?? null;
    const entries = contextEntries(app, palette);
    app.contextPoint = null;
    showMenu(
      entries.map((x, i) => ({ label: x.label, ...(x.keys ? { keys: x.keys } : {}), separated: x.id === 'delete' && i > 0, run: x.run })),
      { x: e.clientX, y: e.clientY },
      t(ui.selection.size > 0 ? 'ctx.label' : 'ctx.labelEmpty'),
    );
  };
  let shift = false;
  const gestures = selectGestures(app);
  const marquee = el('div', { class: 'marquee' });
  marquee.hidden = true;
  shell.viewport.append(marquee);
  const showMarquee = () => {
    const d = ui.drag;
    marquee.hidden = d?.kind !== 'marquee';
    if (d?.kind !== 'marquee') return;
    marquee.classList.toggle('crossing', d.b.x < d.a.x);
    marquee.style.left = `${Math.min(d.a.x, d.b.x)}px`;
    marquee.style.top = `${Math.min(d.a.y, d.b.y)}px`;
    marquee.style.width = `${Math.abs(d.b.x - d.a.x)}px`;
    marquee.style.height = `${Math.abs(d.b.y - d.a.y)}px`;
  };
  const local = (e: PointerEvent): Point2 => {
    const r = shell.viewport.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** Snap for grips: like drawing, without the wall being stretched. */
  const snapAt = (p: Point2, exclude: ReadonlySet<WallId>) =>
    snap({
      cursor: p,
      mpp: ui.view === 'plan' ? 1 / app.plan.scale : app.scene.metresPerPixel(p, 0),
      segments: app.store.get().walls.filter((x) => x.levelId === ui.levelId && !exclude.has(x.id)),
      from: null,
      chainStart: null,
      enabled: ui.snaps,
      orthogonal: false,
      guides: app.levelGuides(),
    });
  /**
   * A guide (guide-tool.ts), in the tools that draw by points, in plan: Alt over a wall or a guide
   * starts it. Held, moved and let go, it is placed where it was let go; tapped, it stays until a
   * click, Enter or a typed distance (or Alt again) places it, or Esc drops it.
   */
  const guideTools = () => ui.view === 'plan' && (ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'measure') && !ui.drag;
  /** Where the pointer was when Alt was pressed, while it is held; whether it moved since. */
  let altAt: Point2 | null = null;
  let altMoved = false;

  const worldAt = (e: PointerEvent | MouseEvent): { p: Point2; mpp: number } | null => {
    if (ui.view === 'plan') {
      const r = shell.planCanvas.getBoundingClientRect();
      return { p: app.plan.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top }), mpp: 1 / app.plan.scale };
    }
    const z = (levelOf(app.store.get(), ui.levelId)?.elevation ?? 0) + app.lift(ui.levelId);
    const p = app.scene.groundPoint(e.clientX, e.clientY, z);
    return p ? { p, mpp: app.scene.metresPerPixel(p, z) } : null;
  };

  /**
   * The point a drawing tool or an opening aims at. In 3D it is the one seen under the pointer, on the
   * level's walls, doors, windows and floors (or the level below's, which upper walls stand on): the top
   * of a wall is where its end is, not the floor far behind it. Elsewhere, and for dragging (whose
   * moves must stay on one plane), worldAt.
   */
  const aimAt3d = (e: PointerEvent | MouseEvent): { p: Point2; mpp: number } | null => {
    if (ui.view === 'plan') return worldAt(e);
    const doc = app.store.get();
    const levels = new Set([ui.levelId, app.levelBelow()]);
    const onLevel = new Set([
      ...doc.walls.filter((w) => levels.has(w.levelId)).map((w) => w.id),
      // The registry's surfaces (a floor) on those levels.
      ...[...eachSolid(app.geometry.kinds)].filter((x) => x.kind.surface && x.levelId !== null && levels.has(x.levelId)).map((x) => x.id),
    ]);
    const walls = new Set(doc.walls.filter((w) => levels.has(w.levelId)).map((w) => w.id));
    for (const o of doc.openings) if (walls.has(o.wallId)) onLevel.add(o.id);
    const hit = app.scene.surfacePoint(e.clientX, e.clientY, (id) => onLevel.has(id));
    return hit ? { p: hit.p, mpp: app.scene.metresPerPixel(hit.p, hit.height) } : worldAt(e);
  };

  // The walls' faces on the level, for the tape: the outline of their pieces, once per geometry. Every
  // piece's side was one before, and the line between a wall's plaster and its core caught the tape
  // first (a room of 4,35 m measured 4,38 m, core to core).
  let faceCache: { geometry: typeof app.geometry; levelId: string; faces: { start: Point2; end: Point2; face: true }[] } | null = null;
  const levelFaces = () => {
    if (!faceCache || faceCache.geometry !== app.geometry || faceCache.levelId !== ui.levelId) {
      const polygons = [...app.geometry.solids.values()].filter((s) => s.wall.levelId === ui.levelId).flatMap((s) => s.pieces.map((p) => p.polygon));
      faceCache = { geometry: app.geometry, levelId: ui.levelId, faces: outerSides(polygons).map((s) => ({ start: s.a, end: s.b, face: true as const })) };
    }
    return faceCache.faces;
  };
  // The faces of the level below's walls, for a wall drawn on its exterior or interior face: snapped
  // onto them, it stands flush on the wall below (a wall drawn on its axis has the axes below).
  let belowCache: { geometry: unknown; levelId: string; faces: { start: Point2; end: Point2; face: true }[] } | null = null;
  const belowFaces = (levelId: string) => {
    if (!belowCache || belowCache.geometry !== app.geometry || belowCache.levelId !== levelId) {
      const polygons = [...app.geometry.solids.values()].filter((s) => s.wall.levelId === levelId).flatMap((s) => s.pieces.map((p) => p.polygon));
      belowCache = { geometry: app.geometry, levelId, faces: outerSides(polygons).map((s) => ({ start: s.a, end: s.b, face: true as const })) };
    }
    return belowCache.faces;
  };
  /** Half a wall's thickness: its ends snap from anywhere on its body near them (snap.ts: reach). */
  const halfOf = (id: string) => (app.geometry.solids.get(id)?.layers.reduce((t, l) => t + l.thickness, 0) ?? 0) / 2;
  const snapped = (e: PointerEvent | MouseEvent) => {
    const at = aimAt3d(e);
    if (!at) return null;
    const w = ui.wall;
    // A floor's outline snaps as a wall chain does: from its last corner, closing on its first once
    // it has three (its corners were free points, off the walls and the grid).
    const draft = ui.tool === 'floor' ? ui.floorDraft : null;
    // The tape snaps from its start, and onto the walls' faces and corners too: one measures a room
    // from wall to wall, not from axis to axis.
    const tape =
      ui.tool === 'measure' && ui.measure.kind === 'from'
        ? ui.measure.a
        : ui.tool === 'dimension' && ui.dimension.kind === 'from'
          ? ui.dimension.a
          : ui.tool === 'grid'
            ? ui.gridFrom
            : ui.tool === 'beam'
              ? ui.beamFrom
              : ui.tool === 'roof'
                ? (ui.roofDraft.at(-1) ?? null)
                : ui.tool === 'stair'
                  ? ui.stairFrom
                  : ui.tool === 'railing'
                    ? (ui.railingDraft.at(-1) ?? null)
                    : null;
    const measuring = ui.tool === 'measure' || ui.tool === 'dimension';
    const modifyFrom = ui.tool === 'modify' && ui.modify && ui.modify.state.step !== 'base' ? ui.modify.state.base : null;
    const faces = measuring ? levelFaces() : [];
    // The level below's walls too, without their numbers (those are the other level's): drawing an
    // upper floor snaps onto the walls it stands on.
    const below = ui.hidden.has('walls') ? null : app.levelBelow();
    const walls = app.store.get().walls;
    const onFace = ui.tool === 'wall' && ui.defaults.referenceLine !== 'centerline' && below !== null;
    return snap({
      cursor: at.p,
      mpp: at.mpp,
      // Measuring, the faces come first and an axis catches only near itself: on a wall's body the
      // tape takes the face, not the axis the body otherwise stands for.
      segments: [
        ...faces,
        ...(onFace ? belowFaces(below) : []),
        ...walls.filter((x) => x.levelId === ui.levelId).map((x) => ({ id: x.id, start: x.start, end: x.end, reach: measuring ? 0 : halfOf(x.id), ...(x.bulge ? { bulge: x.bulge } : {}) })),
        ...walls.filter((x) => x.levelId === below).map((x) => ({ start: x.start, end: x.end, reach: measuring ? 0 : halfOf(x.id), ...(x.bulge ? { bulge: x.bulge } : {}) })),
      ],
      // Modifying, snapped from the base point: right angles and 15° steps from it, as a wall from its last point.
      from: tape ?? modifyFrom ?? (draft ? (draft.at(-1) ?? null) : w.kind === 'drawing' ? w.last : null),
      chainStart: draft ? (draft.length >= 3 ? draft[0]! : null) : (w.kind === 'drawing' && w.count >= 2) || w.kind === 'bend' ? w.start : null,
      enabled: ui.snaps,
      orthogonal: shift,
      // The axes as lines to snap onto, as guides are, and where they cross.
      guides: [...app.levelGuides(), ...app.shownGrids().flatMap((g) => (distance(g.start, g.end) > 0 ? [{ point: g.start, dir: normalize(sub(g.end, g.start)) }] : []))],
    });
  };

  /**
   * The Split tool's point: only a snap on a wall's body or its middle. An alignment or an extension
   * names the wall it comes from, away from the point: in the void, aligned with a wall's end, the
   * click went to that wall ("too near an end"), and the guide promised a cut where there is no wall.
   */
  const splitSnap = (e: PointerEvent | MouseEvent) => {
    const s = snapped(e);
    return s && (s.kind === 'onWall' || s.kind === 'midpoint') ? s : null;
  };

  /** The element under the pointer: an opening before the wall that hosts it. */
  const pickAt = (e: PointerEvent, at: { p: Point2 } | null) =>
    ui.view === 'plan' ? (at ? planPick(at.p) : null) : app.scene.pick(e.clientX, e.clientY);
  /** In plan: what is under the point, in the order a click takes it: an opening, its wall, rooms, floors. */
  const planHits = (p: Point2): string[] => {
    const g = app.visibleGeometry();
    // Within a few pixels of a wall, a door or a window, it is taken: aiming inside a thin wall, or at a
    // door's leaf, was the only way before.
    const near = PICK_PX / app.plan.scale;
    // The registry's kinds under the point, by where they come among the rest (contract.ts: pick); of
    // one order, the one drawn last first. A handle (an axis's bubble, over the walls at a corner) first of all.
    const solids = [...eachSolid(g.kinds)].reverse();
    const grabbed = solids.filter((x) => x.kind.grab?.(x.solid, p, app.plan.scale)).slice(0, 1).map((x) => x.id);
    // Of those hit, the nearest first (a door's leaf over the next door's: contract.ts, distance).
    const kindHits = (order: PickOrder) =>
      solids
        .filter((x) => x.kind.pick === order && x.kind.hit(x.solid, p, near, app.plan.scale))
        .map((x) => ({ id: x.id, d: x.kind.distance?.(x.solid, p) ?? 0 }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.id);
    return [
      ...grabbed,
      // A dimension by its line or its value, before what it measures.
      ...kindHits('first'),
      // A text over everything it is written on (the last kind drawn, so the first here); a door or a
      // window before the wall that hosts it.
      ...kindHits('beforeWalls'),
      ...kindHits('walls'),
      // A guide where the pointer is on it (before the room it runs across), beams, and an axis after
      // the walls on it: a click on a wall over an axis takes the wall.
      ...kindHits('afterWalls'),
      // Last, what lies over everything (a roof: its overhang, outside the walls, is where it is taken first).
      ...kindHits('last'),
    ].filter((id): id is string => id !== null);
  };
  const planPick = (p: Point2): string | null => planHits(p)[0] ?? null;
  /**
   * A click again on the one element selected takes the next one under the point, round to the first:
   * a room's floor lies under the room and was reached by no click; so is a door's wall under the door.
   */
  let again: string | null = null;

  /** A section box face being dragged by its handle: the box and the pointer as it was pressed. */
  let boxDrag: { face: BoxFace; box: SectionBox; from: { x: number; y: number }; along: { x: number; y: number } } | null = null;
  const onMove = (e: PointerEvent) => {
    if (app.walker) {
      if (looking) {
        app.walkLook(e.clientX - looking.x, e.clientY - looking.y);
        looking = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    shift = e.shiftKey;
    // The right button pressed while the left one is held (a chord) comes as a move, not a down:
    // during a drag it cancels it, as a right click does.
    if (e.button === 2 && (e.buttons & 1) === 1 && endWithRightClick()) return;
    app.pointer = { x: e.clientX, y: e.clientY };
    if (boxDrag) {
      const d = dragDistance({ x: e.clientX - boxDrag.from.x, y: e.clientY - boxDrag.from.y }, boxDrag.along);
      return app.setBox(moveFace(boxDrag.box, boxDrag.face, d), false);
    }
    if (ui.view === '3d' && ui.view3d.box && (e.buttons & 1) === 0) {
      const hot = app.boxHandleAt(e.clientX, e.clientY);
      if (hot !== app.boxHot) {
        app.boxHot = hot;
        app.render();
      }
      if (hot) return;
    }
    if (panning && ui.view === 'plan') {
      app.plan.panBy(e.clientX - panning.x, e.clientY - panning.y);
      panning = { x: e.clientX, y: e.clientY };
      app.render();
      return;
    }
    const at = worldAt(e);
    ui.cursor = at?.p ?? null;
    // Only selecting highlights what is under the pointer; another tool must not leave it lit.
    if (ui.tool !== 'select') ui.hover = null;
    if (ui.guide) {
      if (altAt && Math.hypot(e.clientX - altAt.x, e.clientY - altAt.y) > 4) altMoved = true;
      if (at) app.moveGuide(at.p);
      return;
    }
    if (ui.tool === 'wall') {
      const s = snapped(e);
      ui.snap = s;
      if (s && ui.wall.kind !== 'idle') return app.wallEvent({ kind: 'move', point: s.point });
      return app.render();
    }
    if (ui.tool === 'measure' || ui.tool === 'dimension' || ui.tool === 'grid' || ui.tool === 'column' || ui.tool === 'beam' || ui.tool === 'roof' || ui.tool === 'stair' || ui.tool === 'railing') {
      ui.snap = snapped(e);
      return app.render();
    }
    if (ui.tool === 'modify') {
      // The result follows the pointer: a preview of the whole selection, copies included.
      ui.snap = snapped(e);
      return app.refresh();
    }
    if (ui.tool === 'split') {
      // Where the cut would go: on a wall's body or its middle, named.
      ui.snap = splitSnap(e);
      return app.render();
    }
    if (ui.tool === 'corner') {
      // The wall a click would take, lit.
      ui.hover = at && ui.view === 'plan' ? wallAt(app.visibleGeometry(), at.p, undefined, PICK_PX / app.plan.scale) : null;
      return app.render();
    }
    if (ui.tool === 'floor') {
      // The outline's next corner where a click would put it: snapped, shown with its label.
      ui.snap = snapped(e);
      if (ui.floorDraft.length > 0) return app.render();
    }
    if (ui.tool === 'room' || ui.tool === 'floor') {
      // These tools act on rooms: only the room under the pointer is lit, never a wall (lit, it looked
      // as if the click would take it).
      const g = app.visibleGeometry();
      ui.hover = at && ui.view === 'plan' ? ([...g.rooms.values()].find((r) => r.enclosed && insideRing(r.outline, at.p))?.room.id ?? null) : null;
      // Over closed walls with no room yet, the room a click makes there, before the click.
      ui.roomSpace = ui.tool === 'room' && at && ui.view === 'plan' && ui.hover === null ? app.roomSpaceAt(at.p) : null;
      return app.render();
    }
    if (app.openingKind()) {
      const seen = aimAt3d(e);
      return app.openingEvent({ kind: 'hover', aim: seen ? aimAt(app.store.get(), app.geometry, ui.levelId, seen.p, seen.mpp, OPENING_PREVIEW_ID) : null });
    }
    if (downAt && ui.tool === 'select') {
      gestures.move(local(e), at?.p ?? null, snapAt, e.shiftKey, e.altKey);
      showMarquee();
      return;
    }
    const hover = pickAt(e, at);
    if (hover !== ui.hover) ui.hover = hover;
    app.render();
  };

  /** While walking, a drag turns the view (walk.ts). */
  let looking: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    // A point of interest's disc: its card opens (or closes), whatever the tool, walking too.
    if (e.button === 0 && (ui.tool === 'select' || app.walker)) {
      const poi = app.pointAt(e.clientX, e.clientY);
      if (poi) return app.showPoint(app.openPointId === poi ? null : poi);
    }
    if (app.walker) {
      if (e.button === 0) {
        looking = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }
    shift = e.shiftKey;
    // What the footer said about the last action is old news once the user acts on the drawing again.
    ui.info = null;
    (e.target as HTMLElement).focus?.();
    if (e.button === 1 && ui.view === 'plan') {
      e.preventDefault();
      panning = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 2) rightAt = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    // A section box handle: its face goes with the pointer, along the face's axis on screen.
    const face = app.boxHandleAt(e.clientX, e.clientY);
    if (face && ui.view3d.box) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      boxDrag = { face, box: ui.view3d.box, from: { x: e.clientX, y: e.clientY }, along: app.boxFaceOnScreen(face) };
      app.boxHot = face;
      return app.render();
    }
    downAt = { x: e.clientX, y: e.clientY };
    if (ui.tool === 'select') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const at = worldAt(e);
      const hit = pickAt(e, at);
      again = ui.view === 'plan' && !e.shiftKey && hit !== null && ui.selection.size === 1 && ui.selection.has(hit) ? hit : null;
      gestures.down(local(e), at?.p ?? null, hit, e.shiftKey);
    }
  };

  /**
   * What a right click ends before it opens any menu: a wall chain (as Enter: the walls drawn stay), a
   * floor outline (closed from three corners, dropped before), the measure tool's tape, a drag (as
   * Esc). True when it ended something.
   */
  const endWithRightClick = (): boolean => {
    if (ui.tool === 'modify') {
      app.setTool('select');
      return true;
    }
    if (ui.guide) {
      app.cancelGuide();
      return true;
    }
    if (gestures.cancel()) {
      downAt = null;
      showMarquee();
      return true;
    }
    if (ui.tool === 'wall' && ui.wall.kind !== 'idle') {
      app.wallEvent({ kind: 'enter' });
      return true;
    }
    if (ui.tool === 'floor' && ui.floorDraft.length > 0) {
      if (ui.floorDraft.length >= 3) app.floorFinish();
      else {
        ui.floorDraft = [];
        app.render();
      }
      return true;
    }
    if (ui.tool === 'dimension' && ui.dimension.kind !== 'idle') {
      app.dimensionEvent({ kind: 'escape' });
      return true;
    }
    if (ui.tool === 'grid' && ui.gridFrom) {
      app.gridEscape();
      return true;
    }
    if (ui.tool === 'beam' && ui.beamFrom) {
      ui.beamFrom = null;
      app.render();
      return true;
    }
    if (ui.tool === 'roof' && ui.roofDraft.length > 0) {
      app.roofFinish();
      return true;
    }
    if (ui.tool === 'railing' && ui.railingDraft.length > 0) {
      app.railingFinish();
      return true;
    }
    if (ui.tool === 'measure' && ui.measure.kind !== 'idle') {
      app.measureEvent({ kind: 'escape' });
      return true;
    }
    return false;
  };

  const onUp = (e: PointerEvent) => {
    if (app.walker) {
      looking = null;
      return;
    }
    if (boxDrag) {
      boxDrag = null;
      app.boxHot = null;
      if (ui.view3d.box) app.setBox(ui.view3d.box, true);
      return;
    }
    if (panning) {
      panning = null;
      return;
    }
    if (e.button === 2 && rightAt) {
      // A right drag orbits the 3D view; only a click opens the menu.
      const moved = Math.hypot(e.clientX - rightAt.x, e.clientY - rightAt.y) > 4;
      rightAt = null;
      if (moved) return;
      // As in Revit and AutoCAD, a right click first ends what is under way, without a menu.
      if (endWithRightClick()) return;
      contextMenu(e);
      return;
    }
    if (e.button !== 0 || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4;
    downAt = null;
    // A click places the guide being set; it is no point of the drawing.
    if (ui.guide) return app.placeGuide();
    if (ui.tool === 'select') {
      const clicked = gestures.up(e.shiftKey);
      showMarquee();
      const at = clicked && again !== null ? worldAt(e) : null;
      if (at) {
        const hits = planHits(at.p);
        const next = hits[(hits.indexOf(again!) + 1) % hits.length];
        if (next && next !== again) {
          ui.selection = new Set([next]);
          app.refresh();
        }
      }
      again = null;
      return;
    }
    if (moved) return;
    if (app.openingKind()) return app.openingEvent({ kind: 'click' });
    if (ui.tool === 'modify') {
      const at = aimAt3d(e);
      if (at) app.modifyEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'split') {
      const s = splitSnap(e);
      const at = aimAt3d(e);
      if (at) app.splitAt(s?.point ?? at.p, s?.wallId ?? (ui.view === 'plan' ? (wallAt(app.visibleGeometry(), at.p, undefined, PICK_PX / app.plan.scale) ?? undefined) : undefined));
      return;
    }
    if (ui.tool === 'corner') {
      const at = worldAt(e);
      if (at) app.cornerClick(ui.view === 'plan' ? wallAt(app.visibleGeometry(), at.p, undefined, PICK_PX / app.plan.scale) : app.scene.pick(e.clientX, e.clientY));
      return;
    }
    if (ui.tool === 'measure') {
      const at = worldAt(e);
      if (at) app.measureEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'dimension') {
      const at = worldAt(e);
      if (at) app.dimensionEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'grid') {
      const at = worldAt(e);
      if (at && ui.view === 'plan') app.gridClick(snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'column') {
      const at = aimAt3d(e);
      if (at) app.columnClick(snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'beam') {
      const at = aimAt3d(e);
      if (at) app.beamClick(snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'roof') {
      const at = worldAt(e);
      if (at) app.roofClick(snapped(e)?.point ?? at.p, at.mpp);
      return;
    }
    if (ui.tool === 'stair') {
      const at = aimAt3d(e);
      if (at) app.stairClick(snapped(e)?.point ?? at.p);
      return;
    }
    if (ui.tool === 'railing') {
      const at = aimAt3d(e);
      if (at) app.railingClick(snapped(e)?.point ?? at.p, at.mpp);
      return;
    }
    if (ui.tool === 'room' || ui.tool === 'floor') {
      const at = worldAt(e);
      if (!at) return;
      if (ui.tool === 'room') {
        // A finger does not hover: its first tap in a space shows the room it would make there, as
        // the pointer does before a click, and a second tap in that space makes it. One tap made it
        // unseen.
        if (e.pointerType === 'touch' && ui.view === 'plan') {
          const space = app.roomSpaceAt(at.p);
          if (space && !(ui.tapToConfirm && ui.roomSpace && insideRing(ui.roomSpace, at.p))) {
            ui.roomSpace = space;
            ui.tapToConfirm = true;
            return app.render();
          }
        }
        ui.tapToConfirm = false;
        return app.roomClick(at.p);
      }
      // Inside a room (its floor) as clicked; a corner where it snaps.
      return app.floorClick(at.p, at.mpp, false, snapped(e)?.point ?? at.p);
    }
    const s = snapped(e);
    if (s) app.wallEvent({ kind: 'click', point: s.point });
  };

  for (const c of [shell.planCanvas, shell.glCanvas]) {
    c.tabIndex = 0;
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', () => {
      ui.hover = null;
      ui.cursor = null;
      app.pointer = null;
      if (app.openingKind()) return app.openingEvent({ kind: 'hover', aim: null });
      app.render();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  shell.planCanvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = shell.planCanvas.getBoundingClientRect();
      app.plan.zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
      app.render();
    },
    { passive: false },
  );

  // Top bar, tools, floating bar, footer.
  wireButtons(app, palette);
  const stickAt = (e: PointerEvent) => {
    const r = shell.walkStick.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) [dx, dy] = [dx / len, dy / len];
    shell.walkKnob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`;
    app.walkStick = { forward: -dy, side: dx };
  };
  shell.walkStick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    shell.walkStick.setPointerCapture(e.pointerId);
    stickAt(e);
  });
  shell.walkStick.addEventListener('pointermove', (e) => {
    if (app.walkStick) stickAt(e);
  });
  const stickOff = () => {
    app.walkStick = null;
    shell.walkKnob.style.transform = '';
  };
  shell.walkStick.addEventListener('pointerup', stickOff);
  shell.walkStick.addEventListener('pointercancel', stickOff);
  // The preview follows what is typed, before Enter: the wall preview is geometry, so refresh it.
  shell.measure.addEventListener('input', () => app.refresh());
  shell.measure.addEventListener('keydown', (e) => {
    // Alt over a wall starts a guide from the field too: a value left in it (one the drawing did not
    // take) kept the focus, and Alt did nothing. The field is left; the drawing's keys take Alt.
    if (e.key === 'Alt' && !ui.guide && guideTools()) {
      shell.measure.value = '';
      shell.measure.blur();
      return;
    }
    e.stopPropagation();
    const drawing = ui.tool === 'wall' && ui.wall.kind === 'drawing';
    if (e.key === 'Tab' && drawing && !e.shiftKey) {
      // Tab moves from the length to the angle: the field reads "length<angle".
      e.preventDefault();
      if (!shell.measure.value.includes('<')) shell.measure.value += '<';
      return app.render();
    }
    if (e.key === 'Enter') {
      const text = shell.measure.value;
      if (app.submitMeasure(text)) {
        // Done with the field: the keys (A, Esc, W…) go back to the drawing.
        shell.measure.value = '';
        shell.measure.blur();
        app.render();
      } else if (text.trim() === '') {
        // An empty Enter does what Enter does outside the field: end the wall chain, close the floor.
        shell.measure.blur();
        if (ui.guide) return app.placeGuide();
        if (ui.tool === 'wall') app.wallEvent({ kind: 'enter' });
        if (ui.tool === 'floor') app.floorFinish();
      }
    } else if (e.altKey && ui.guide && /^[\d.,]$/.test(e.key)) {
      // Alt still held: Windows types nothing with it, so the digit is put in by hand.
      e.preventDefault();
      shell.measure.value += e.key;
      app.refresh();
    } else if (e.key === 'Escape') {
      const had = shell.measure.value.trim() !== '';
      shell.measure.value = '';
      ui.error = null;
      shell.measure.blur();
      if (!had && ui.guide) return app.cancelGuide();
      if (!had && ui.tool === 'modify') return app.modifyEvent({ kind: 'escape' });
      // An empty field has nothing to cancel: Esc acts on the drawing, as it does outside the field.
      if (!had && ui.tool === 'wall' && ui.wall.kind !== 'idle') return app.wallEvent({ kind: 'escape' });
      app.render();
    }
  });

  // Walking (walk.ts): the keys held move the walker each frame; let go, it stops.
  window.addEventListener('keyup', (e) => {
    if (app.walker) app.walkKeys.delete(e.key.toLowerCase());
    if (e.key !== 'Alt') return;
    const target = e.target as HTMLElement;
    if (!target.closest('input, select, textarea')) e.preventDefault();
    const held = altAt !== null;
    altAt = null;
    if (!ui.guide) return;
    e.preventDefault();
    if (held && altMoved && shell.measure.value.trim() === '') app.placeGuide();
  });

  wireKeys(app, {
    get shift() { return shift; },
    set shift(v) { shift = v; },
    get altAt() { return altAt; },
    set altAt(v) { altAt = v; },
    get altMoved() { return altMoved; },
    set altMoved(v) { altMoved = v; },
    get again() { return again; },
    set again(v) { again = v; },
    get downAt() { return downAt; },
    set downAt(v) { downAt = v; },
    gestures,
    guideTools,
    palette,
    showMarquee,
  });
}

/**
 * The project's name, typed where it is shown: Enter or leaving the field keeps it, Esc puts the old one
 * back. It names the saved file and the browser tab (the name could not be changed at all before).
 */
export function renameInPlace(app: App): void {
  const button = app.shell.projectName;
  const input = el('input', { type: 'text', class: 'project-name-input', autocomplete: 'off', spellcheck: 'false', 'aria-label': t('top.rename') });
  input.value = app.store.get().name;
  input.placeholder = t('app.untitled');
  button.hidden = true;
  button.after(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (keep: boolean) => {
    if (done) return;
    done = true;
    const name = input.value;
    input.remove();
    button.hidden = false;
    if (keep) app.renameProject(name);
    button.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Enter' && e.key !== 'Escape') return;
    // Not let through: the focus goes back to the name's button, and the same Enter would press it,
    // opening the field again.
    e.preventDefault();
    finish(e.key === 'Enter');
  });
  input.addEventListener('blur', () => finish(true));
}

export function showHelp(app: App): void {
  const back = app.shell.helpBack;
  // The same names as the palette, buttons and menus (ref/chat.txt:200): read from the same messages.
  const rows: [string, string][] = [
    ['V', t('tool.select')],
    ['W', t('tool.wall')],
    ['W, A', t('pal.arcWall')],
    ['W, Q', t('pal.rectWall')],
    ['D', t('tool.door')],
    ['Shift+W', t('tool.window')],
    ['R', t('tool.room')],
    ['L', t('tool.floor')],
    ['M', t('tool.measure')],
    ['Shift+M', t('pal.move')],
    ['Shift+C', t('pal.copy')],
    ['Shift+R', t('pal.rotate')],
    ['Shift+E', t('pal.scale')],
    ['Shift+X', t('pal.mirror')],
    ['Shift+S', t('pal.split')],
    ['Shift+T', t('pal.corner')],
    ['Shift+J', t('pal.merge')],
    ['Shift+H', t('pal.tempHide')],
    ['Shift+I', t('pal.tempIsolate')],
    [t('help.guideKey'), t('help.guide')],
    ['1 / 2', `${t('view.3d')} / ${t('view.plan')}`],
    ['Enter', t('help.enter')],
    ['Tab', t('help.tab')],
    ['Esc', t('help.esc')],
    ['Backspace', t('help.backspace')],
    [t('key.spaceKey'), t('help.space')],
    [t('help.rightClickKey'), t('help.rightClick')],
    [t('help.dragAloneKey'), t('help.dragAlone')],
    ['U', t('help.disjoin')],
    ['Del', t('pal.delete')],
    ['F', t('pal.frameSelection')],
    ['Home', t('pal.frameAll')],
    ['+ / −', t('help.zoomKeys')],
    ['Shift+↑↓←→', t('help.panKeys')],
    ['S', t('pal.snaps')],
    ['Shift', t('help.shift')],
    ['Ctrl+A', t('pal.selectAll')],
    ['Ctrl+Z', t('pal.undo')],
    ['Ctrl+Shift+Z / Ctrl+Y', t('pal.redo')],
    ['Ctrl+O', t('pal.open')],
    ['Ctrl+S', t('pal.save')],
    ['Ctrl+K', t('pal.commands')],
    ['Shift+L', t('pal.language')],
    ['N', t('pal.stepSelection')],
    ['Shift+N', t('pal.stepBack')],
    [t('help.arrowsKey'), t('help.arrows')],
    ['?', t('pal.shortcuts')],
    [t('help.clickAgainKey'), t('help.clickAgain')],
    [t('help.wheelKey'), t('help.wheel')],
    [t('help.middleKey'), t('help.middle')],
    [t('help.orbitKey'), t('help.orbit')],
  ];
  const close = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
  const dl = el('dl');
  for (const [k, v] of rows) dl.append(el('dt', {}, el('span', { class: 'kbd' }, k)), el('dd', {}, v));
  const dialog = el('div', { class: 'dialog help-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('help.title') }, el('h2', {}, t('help.title')), dl, el('div', { class: 'actions' }, close));
  back.replaceChildren(dialog);
  back.hidden = false;
  const hide = () => {
    back.hidden = true;
    app.shell.planCanvas.focus();
  };
  close.addEventListener('click', hide);
  back.onclick = (e) => {
    if (e.target === back) hide();
  };
  back.onkeydown = (e) => {
    if (e.key === 'Escape') hide();
  };
  // The list takes the focus, so it opens at its top and the arrows and Page Down scroll it (only the
  // list scrolls, help-dialog in styles.css); Tab then reaches Close.
  dl.tabIndex = 0;
  dl.setAttribute('aria-label', t('help.title'));
  dl.scrollTop = 0;
  dl.focus({ preventScroll: true });
}
