// Mouse and keyboard. Plan: wheel zooms at the cursor, middle button pans. 3D: wheel zooms at the
// cursor, middle pans, Shift + middle or right rotates (OrbitControls). Left button is the tool's.

import type { Point2 } from '../core/vector';
import { snap } from '../tools/snap';
import { t } from '../ui/i18n';
import { el } from '../ui/controls';
import { openingAt, wallAt } from './geometry';
import { aimAt, OPENING_PREVIEW_ID } from './opening-ui';
import { viewKey } from './view-keys';
import type { App } from './app';
import { levelOf } from './document';
import { selectGestures } from './select-drag';
import { insideRing } from '../elements/room/derive';
import { EDIT_LEVELS } from './app';
import { showLevels } from '../ui/levels-dialog';
import { showWallTypes } from '../ui/types-dialog';
import { showPalette } from '../ui/palette';
import { offerTour, startTour } from '../ui/tour';
import { appActions, type Openers } from './actions';
import { contextEntries } from './context-menu';
import { arrowStep } from '../tools/nudge';
import { showMenu } from '../ui/menu';
import type { WallId } from '../elements/wall/schema';
import { GUIDE_PX, guideBaseAt } from '../tools/guide-tool';
import { cross, sub } from '../core/vector';

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
    const entries = contextEntries(app, palette);
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
    const z = levelOf(app.store.get(), ui.levelId)?.elevation ?? 0;
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
      ...doc.floors.filter((f) => levels.has(f.levelId)).map((f) => f.id),
    ]);
    const walls = new Set(doc.walls.filter((w) => levels.has(w.levelId)).map((w) => w.id));
    for (const o of doc.openings) if (walls.has(o.wallId)) onLevel.add(o.id);
    const hit = app.scene.surfacePoint(e.clientX, e.clientY, (id) => onLevel.has(id));
    return hit ? { p: hit.p, mpp: app.scene.metresPerPixel(hit.p, hit.height) } : worldAt(e);
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
    const tape = ui.tool === 'measure' && ui.measure.kind === 'from' ? ui.measure.a : null;
    const faces =
      ui.tool === 'measure'
        ? [...app.geometry.solids.values()]
            .filter((s) => s.wall.levelId === ui.levelId)
            .flatMap((s) => s.pieces.flatMap((p) => p.polygon.map((a, i) => ({ start: a, end: p.polygon[(i + 1) % p.polygon.length]!, face: true }))))
        : [];
    // The level below's walls too, without their numbers (those are the other level's): drawing an
    // upper floor snaps onto the walls it stands on.
    const below = ui.hidden.has('walls') ? null : app.levelBelow();
    const walls = app.store.get().walls;
    return snap({
      cursor: at.p,
      mpp: at.mpp,
      // Measuring, the faces come first and an axis catches only near itself: on a wall's body the
      // tape takes the face, not the axis the body otherwise stands for.
      segments: [
        ...faces,
        ...walls.filter((x) => x.levelId === ui.levelId).map((x) => ({ id: x.id, start: x.start, end: x.end, reach: ui.tool === 'measure' ? 0 : halfOf(x.id) })),
        ...walls.filter((x) => x.levelId === below).map((x) => ({ start: x.start, end: x.end, reach: ui.tool === 'measure' ? 0 : halfOf(x.id) })),
      ],
      from: tape ?? (draft ? (draft.at(-1) ?? null) : w.kind === 'drawing' ? w.last : null),
      chainStart: draft ? (draft.length >= 3 ? draft[0]! : null) : (w.kind === 'drawing' && w.count >= 2) || w.kind === 'bend' ? w.start : null,
      enabled: ui.snaps,
      orthogonal: shift,
      guides: app.levelGuides(),
    });
  };

  /** The element under the pointer: an opening before the wall that hosts it. */
  const pickAt = (e: PointerEvent, at: { p: Point2 } | null) =>
    ui.view === 'plan' ? (at ? planPick(at.p) : null) : app.scene.pick(e.clientX, e.clientY);
  /** In plan: what is under the point, in the order a click takes it: an opening, its wall, rooms, floors. */
  const planHits = (p: Point2): string[] => {
    const g = app.visibleGeometry();
    const reach = GUIDE_PX / app.plan.scale;
    return [
      openingAt(g, p),
      wallAt(g, p),
      // A guide where the pointer is on it: before the room it runs across.
      ...app
        .levelGuides()
        .map((x) => ({ id: x.id, off: Math.abs(cross(x.dir, sub(p, x.point))) }))
        .filter((x) => x.off <= reach)
        .sort((a, b) => a.off - b.off)
        .slice(0, 1)
        .map((x) => x.id),
      ...[...g.rooms.values()].filter((r) => r.enclosed && insideRing(r.outline, p)).map((r) => r.room.id),
      ...[...g.floors.values()].filter((f) => f.outline.length >= 3 && insideRing(f.outline, p)).map((f) => f.floor.id),
    ].filter((id): id is string => id !== null);
  };
  const planPick = (p: Point2): string | null => planHits(p)[0] ?? null;
  /**
   * A click again on the one element selected takes the next one under the point, round to the first:
   * a room's floor lies under the room and was reached by no click; so is a door's wall under the door.
   */
  let again: string | null = null;

  const onMove = (e: PointerEvent) => {
    shift = e.shiftKey;
    // The right button pressed while the left one is held (a chord) comes as a move, not a down:
    // during a drag it cancels it, as a right click does.
    if (e.button === 2 && (e.buttons & 1) === 1 && endWithRightClick()) return;
    app.pointer = { x: e.clientX, y: e.clientY };
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
    if (ui.tool === 'measure') {
      ui.snap = snapped(e);
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

  const onDown = (e: PointerEvent) => {
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
    if (ui.tool === 'measure' && ui.measure.kind !== 'idle') {
      app.measureEvent({ kind: 'escape' });
      return true;
    }
    return false;
  };

  const onUp = (e: PointerEvent) => {
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
    if (ui.tool === 'measure') {
      const at = worldAt(e);
      if (at) app.measureEvent({ kind: 'click', point: snapped(e)?.point ?? at.p });
      return;
    }
    if (ui.tool === 'room' || ui.tool === 'floor') {
      const at = worldAt(e);
      if (!at) return;
      if (ui.tool === 'room') return app.roomClick(at.p);
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
  shell.undo.addEventListener('click', () => app.undo());
  shell.redo.addEventListener('click', () => app.redo());
  shell.homeBtn.addEventListener('click', () => app.frameAll());
  shell.view3d.addEventListener('click', () => app.setView('3d'));
  shell.viewPlan.addEventListener('click', () => app.setView('plan'));
  shell.level.addEventListener('change', () => {
    if (shell.level.value === EDIT_LEVELS) {
      shell.level.value = ui.levelId;
      return showLevels(app);
    }
    app.setLevel(shell.level.value);
  });
  shell.lang.addEventListener('click', () => app.setLanguage(app.otherLanguage()));
  shell.theme.addEventListener('click', () => app.toggleTheme());
  shell.save.addEventListener('click', () => app.saveFile());
  shell.open.addEventListener('click', () => shell.fileInput.click());
  shell.newFile.addEventListener('click', () => app.newProject());
  shell.projectName.addEventListener('click', () => renameInPlace(app));
  shell.fileInput.addEventListener('change', () => {
    const file = shell.fileInput.files?.[0];
    shell.fileInput.value = '';
    if (file) void app.openFile(file);
  });
  shell.panelToggle.addEventListener('click', () => app.togglePanel());
  shell.toolSelect.addEventListener('click', () => app.setTool('select'));
  shell.toolWall.addEventListener('click', () => app.setTool('wall'));
  shell.toolDoor.addEventListener('click', () => app.setTool('door'));
  shell.toolWindow.addEventListener('click', () => app.setTool('window'));
  shell.toolRoom.addEventListener('click', () => app.setTool('room'));
  shell.toolFloor.addEventListener('click', () => app.setTool('floor'));
  shell.toolMeasure.addEventListener('click', () => app.setTool('measure'));
  shell.snapBtn.addEventListener('click', () => app.toggleSnaps());
  shell.shortcuts.addEventListener('click', () => showHelp(app));
  shell.commands.addEventListener('click', () => palette());
  // The preview follows what is typed, before Enter: the wall preview is geometry, so refresh it.
  shell.measure.addEventListener('input', () => app.refresh());
  shell.measure.addEventListener('keydown', (e) => {
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
      // An empty field has nothing to cancel: Esc acts on the drawing, as it does outside the field.
      if (!had && ui.tool === 'wall' && ui.wall.kind !== 'idle') return app.wallEvent({ kind: 'escape' });
      app.render();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key !== 'Alt') return;
    const held = altAt !== null;
    altAt = null;
    if (!ui.guide) return;
    e.preventDefault();
    if (held && altMoved && shell.measure.value.trim() === '') app.placeGuide();
  });

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, select, textarea') || target.closest('.dialog-back')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    shift = e.shiftKey;
    if (ctrl && key === 'z') {
      e.preventDefault();
      return e.shiftKey ? app.redo() : app.undo();
    }
    if (ctrl && key === 'o') {
      e.preventDefault();
      return shell.fileInput.click();
    }
    if (ctrl && key === 's') {
      e.preventDefault();
      return app.saveFile();
    }
    if (ctrl && key === 'y') {
      e.preventDefault();
      return app.redo();
    }
    if (ctrl && key === 'a') {
      e.preventDefault();
      return app.selectAllWalls();
    }
    if (ctrl && key === 'k') {
      e.preventDefault();
      return palette();
    }
    // The view by keyboard (view-keys.ts): + and − zoom, Shift+arrows move or turn it (the tester's K4).
    const typingNow = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || app.openingKind() !== null;
    const view = viewKey(e.key, { shift: e.shiftKey, ctrl, alt: e.altKey, typing: typingNow });
    if (view) {
      e.preventDefault();
      return app.keyView(view);
    }
    if (e.key === 'Alt' && guideTools()) {
      // Kept from the browser, whose menu would take the keys typed next.
      e.preventDefault();
      if (e.repeat) return;
      if (ui.guide) return app.placeGuide();
      const at = app.pointer && ui.cursor;
      const base = at ? guideBaseAt(app.store.get(), ui.levelId, at, 1 / app.plan.scale, { walls: !ui.hidden.has('walls'), guides: !ui.hidden.has('guides') }) : null;
      if (!base || !at) {
        ui.info = t('hint.guideNoBase');
        return app.render();
      }
      altAt = app.pointer;
      altMoved = false;
      return app.startGuide(base, at);
    }
    // A distance for the guide being set, Alt held or not.
    if (ui.guide && /^[\d.,]$/.test(e.key) && !ctrl) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      return app.refresh();
    }
    // Arrows, with or without Alt, before Alt shortcuts are left to the browser.
    const step = !ctrl && !e.shiftKey && ui.selection.size > 0 && ui.view === 'plan' ? arrowStep(e.key, e.altKey) : null;
    if (step) {
      e.preventDefault();
      return app.nudgeSelection(step);
    }
    if (ctrl || e.altKey) return;
    // Typing a number goes straight to the measure field, as in Revit and SketchUp, while a measure is
    // being asked for: drawing a wall or aiming an opening. A selection is edited by clicking its
    // temporary dimensions or in the panel, so 1 and 2 keep switching the view.
    // In the door and window tools a digit is always a measure, aimed or not: it never switches the view
    // (the tester's K2: "1" turned to 3D).
    const typing = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || app.openingKind() !== null;
    if (/^[\d.,-]$/.test(e.key) && typing) {
      e.preventDefault();
      shell.measure.focus();
      shell.measure.value = e.key;
      // Set from here, the value fires no input event: refresh the preview for it as typing does.
      return app.refresh();
    }
    if (e.key === 'Escape') {
      // An error about something typed is over, and so is what was typed.
      if (ui.error !== null) {
        ui.error = null;
        shell.measure.value = '';
      }
      if (ui.guide) return app.cancelGuide();
      if (gestures.cancel()) {
        downAt = null;
        return showMarquee();
      }
      if (app.openingKind()) return app.setTool('select');
      if (ui.tool === 'floor' && ui.floorDraft.length > 0) {
        ui.floorDraft = [];
        return app.render();
      }
      if (ui.tool === 'room' || ui.tool === 'floor') return app.setTool('select');
      if (ui.tool === 'measure') return ui.measure.kind !== 'idle' ? app.measureEvent({ kind: 'escape' }) : app.setTool('select');
      if (ui.tool === 'wall') return ui.wall.kind !== 'idle' ? app.wallEvent({ kind: 'escape' }) : app.setTool('select');
      ui.selection.clear();
      return app.refresh();
    }
    if (e.key === 'Enter' && ui.guide) return app.placeGuide();
    if (e.key === 'Enter' && ui.tool === 'wall') return app.wallEvent({ kind: 'enter' });
    if (e.key === 'Enter' && ui.tool === 'floor') return app.floorFinish();
    // Enter places the opening where it is aimed, as a click there does.
    if (e.key === 'Enter' && app.openingKind() && ui.opening.kind === 'aiming') return app.openingEvent({ kind: 'click' });
    if (e.key === 'Delete' || e.key === 'Backspace') return app.deleteSelection();
    if (e.key === 'Home') return app.frameAll();
    if (e.key === '?') return showHelp(app);
    if (e.shiftKey && key === 'l') return app.setLanguage(app.otherLanguage());
    if (e.shiftKey && key === 'w') return app.setTool('window');
    if (e.shiftKey && key === 'n') return app.stepSelection(-1);
    if (e.shiftKey) return;
    if (key === 'w') return app.setTool('wall');
    if (key === 'a' && ui.tool === 'wall') return app.wallEvent({ kind: 'arc' });
    if (key === 'd') return app.setTool('door');
    if (key === 'r') return app.setTool('room');
    if (key === 'l') return app.setTool('floor');
    if (key === 'm') return app.setTool('measure');
    if (key === 'v') return app.setTool('select');
    if (key === 'f') return app.frameSelection();
    // Choosing and moving elements without a mouse: N / Shift+N go through the level's elements;
    // the arrows move the selection by 5 cm (the snap grid), 1 cm with Alt (tools/nudge.ts).
    if (key === 'n') return app.stepSelection(e.shiftKey ? -1 : 1);
    if (key === 's') return app.toggleSnaps();
    if (key === '1') return app.setView('3d');
    if (key === '2') return app.setView('plan');
  });
}

/**
 * The project's name, typed where it is shown: Enter or leaving the field keeps it, Esc puts the old one
 * back. It names the saved file and the browser tab (the name could not be changed at all before).
 */
function renameInPlace(app: App): void {
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

function showHelp(app: App): void {
  const back = app.shell.helpBack;
  // The same names as the palette, buttons and menus (ref/chat.txt:200): read from the same messages.
  const rows: [string, string][] = [
    ['V', t('tool.select')],
    ['W', t('tool.wall')],
    ['W, A', t('pal.arcWall')],
    ['D', t('tool.door')],
    ['Shift+W', t('tool.window')],
    ['R', t('tool.room')],
    ['L', t('tool.floor')],
    ['M', t('tool.measure')],
    [t('help.guideKey'), t('help.guide')],
    ['1 / 2', `${t('view.3d')} / ${t('view.plan')}`],
    ['Enter', t('help.enter')],
    ['Tab', t('help.tab')],
    ['Esc', t('help.esc')],
    [t('help.rightClickKey'), t('help.rightClick')],
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
