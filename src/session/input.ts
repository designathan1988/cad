// Mouse and keyboard. Plan: wheel zooms at the cursor, middle button pans. 3D: wheel zooms at the
// cursor, middle pans, Shift + middle or right rotates (OrbitControls). Left button is the tool's.

import { showSections } from '../ui/sections-dialog';
import { showOverrides } from '../ui/overrides-dialog';
import { showVariables } from '../ui/variables-dialog';
import { showKeys } from '../ui/keys-dialog';
import { wallNumber } from '../project/doc';
import { type MessageKey, t } from '../i18n/messages';
import { showObjects } from '../ui/objects-dialog';
import { showOpenings } from '../ui/openings-dialog';
import { showFloors } from '../ui/floors-dialog';
import { presetSlotOf, showPresets } from '../ui/presets-dialog';
import { showUnits } from '../ui/units-dialog';
import { showDrawingSettings } from '../ui/drawing-dialog';
import { distance, normalize, type Point2, sub } from '../model/vector';
import { el } from '../ui/controls';
import type { App } from './app';
import { selectGestures } from './drag';
import { showLevels } from '../ui/levels-dialog';
import { showWallTypes } from '../ui/types-dialog';
import { showMaterials } from '../ui/materials-dialog';
import { showPalette } from '../ui/palette';
import { showProjectsDialog } from '../ui/projects-dialog';
import { appActions, type Openers } from './actions';
import { menuEntries } from './context-menu';
import { showMenu } from '../ui/menu';
import { wireKeys } from './input-keys';
import { wireButtons } from './input-buttons';
import { cancelGuide } from '../elements/guide/tool-ui';
import { submitMeasure, wallEvent } from '../elements/wall/tool-ui';
import { floorFinish } from './room-tool';
import { pointerAim } from './pointer-aim';
import { showHelp } from '../ui/help-dialog';
import { pointerState } from './pointer-state';
import { pointerHandlers } from './pointer-handlers';
import * as appPlacing from './app-placing';
import * as appSettings from './app-settings';

export function wireInput(app: App): void {
  const { shell, ui } = app;
  const ptr = pointerState();
  const openers: Openers = {
    help: () => showHelp(app),
    levels: () => showLevels(app),
    wallTypes: () => showWallTypes(app),
    materials: () => showMaterials(app),
    units: () => showUnits(app),
    objects: () => showObjects(app),
    openings: () => showOpenings(app, app.openingKind() ?? undefined),
    floors: () => showFloors(app),
    presets: () => showPresets(app, presetSlotOf(app.ui.tool)),
    openFile: () => shell.fileInput.click(),
    projects: () => showProjectsDialog(app),
    drawing: () => showDrawingSettings(app),
    keys: () => showKeys(app),
    variables: () => showVariables(app),
  };
  app.openProjects = () => showProjectsDialog(app);
  const palette = () => showPalette(appActions(app, openers));
  // The ribbon and the File menu run the same actions the palette lists.
  app.actionList = () => appActions(app, openers);
  app.openCommands = palette;
  app.openLevels = () => showLevels(app);
  app.openSections = (id) => showSections(app, id);
  app.openWallTypes = (typeId) => showWallTypes(app, typeId);
  app.openMaterials = () => showMaterials(app);
  app.openUnits = () => showUnits(app);
  app.openObjects = () => showObjects(app);
  app.openOverrides = () => showOverrides(app);
  shell.sidebar.addEventListener('click', () => appSettings.toggleBrowser(app));
  /** The menu for what is under the pointer: it becomes the selection, unless it is already in it. */
  const contextMenu = (e: PointerEvent) => {
    if (ui.error !== null) shell.measure.value = '';
    ui.error = null;
    if (ui.tool !== 'select') app.setTool('select');
    const hit = pickAt(e, worldAt(e));
    if (hit && !ui.selection.has(hit)) ui.selection = new Set([hit]);
    if (!hit) ui.selection.clear();
    app.refresh();
    // Where the menu was opened, for "Add text": the pointer leaves the drawing for the menu.
    app.contextPoint = worldAt(e)?.p ?? null;
    // Whole and grouped (context-actions.ts, menuGroups), a line between groups; the floating bar keeps its few.
    const groups = menuEntries(app, palette);
    app.contextPoint = null;
    showMenu(
      groups.flatMap((g, gi) => g.map((x, i) => ({ label: x.label, icon: x.icon, ...(x.keys ? { keys: x.keys } : {}), separated: gi > 0 && i === 0, run: x.run }))),
      { x: e.clientX, y: e.clientY },
      t(ui.selection.size > 0 ? 'ctx.label' : 'ctx.labelEmpty'),
    );
  };
  /** Something drawn by points is under way with the tool in use: what Finish ends. */
  const underWay = () =>
    (ui.tool === 'wall' && ui.wall.kind !== 'idle') ||
    ui.floorDraft.length > 0 ||
    ui.roofDraft.length > 0 ||
    ui.railingDraft.length > 0 ||
    ui.markDraft.length > 0 ||
    ui.measure.kind !== 'idle' ||
    ui.dimension.kind !== 'idle' ||
    ui.gridFrom !== null ||
    ui.sectionFrom !== null ||
    ui.calloutFrom !== null ||
    ui.beamFrom !== null;
  /**
   * A right click with a drawing tool: its menu, Finish (what a right click did unseen: a chain ended, an
   * outline closed, a start dropped, each tool its own) and the way out of the tool; it did one of them
   * with nothing on screen saying which (docs/revisao-interface.md, M2).
   */
  const toolMenu = (e: PointerEvent) => {
    showMenu(
      [
        { label: t('ctx.toolFinish'), icon: 'check', keys: 'Enter', disabled: !underWay(), run: () => void handlers.endWithRightClick() },
        { label: t('ctx.toolExit'), icon: 'close', keys: 'Esc', separated: true, run: () => app.setTool('select') },
      ],
      { x: e.clientX, y: e.clientY },
      t('ctx.labelTool'),
    );
  };
  const gestures = selectGestures(app);
  // What is being typed in the measure field, beside the pointer (Archicad's tracker): the eyes stay on
  // the drawing while a length, an angle or a point is typed.
  const tracker = el('div', { class: 'tracker', 'aria-hidden': 'true' });
  tracker.hidden = true;
  shell.viewport.append(tracker);
  const showTracker = () => {
    const typing = document.activeElement === shell.measure && shell.measure.value.trim() !== '' && ptr.lastMove !== null;
    tracker.hidden = !typing;
    if (!typing || !ptr.lastMove) return;
    const r = shell.viewport.getBoundingClientRect();
    tracker.textContent = shell.measure.value;
    tracker.style.left = `${ptr.lastMove.clientX - r.left + 18}px`;
    tracker.style.top = `${ptr.lastMove.clientY - r.top + 18}px`;
    tracker.classList.toggle('invalid', ui.error !== null);
  };
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
  const aim = pointerAim(app, () => ptr.shift);
  const { guideTools, worldAt, pickAt } = aim;
  /**
   * A click again on the one element selected takes the next one under the point, round to the first:
   * a room's floor lies under the room and was reached by no click; so is a door's wall under the door.
   */

  const handlers = pointerHandlers(app, { ptr, aim, gestures, tracker, showTracker, showMarquee, contextMenu, toolMenu });
  const { onMove, onDown, onUp } = handlers;

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
  // A double click on a door or window in 3D opens it, or closes it (the selection's Open does too).
  shell.glCanvas.addEventListener('dblclick', () => {
    if (ui.tool !== 'select') return;
    const ids = [...ui.selection].filter((id) => app.store.get().openings.some((o) => o.id === id));
    if (ids.length > 0) appPlacing.toggleOpen(app, ids);
  });
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
  // The preview follows what is typed, before Enter: the wall preview is geometry, so refresh it.
  shell.measure.addEventListener('input', () => {
    app.refresh();
    showTracker();
  });
  shell.measure.addEventListener('blur', showTracker);
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
      if (submitMeasure(app, text)) {
        // Done with the field: the keys (A, Esc, W…) go back to the drawing.
        shell.measure.value = '';
        shell.measure.blur();
        app.render();
      } else if (text.trim() === '') {
        // An empty Enter does what Enter does outside the field: end the wall chain, close the floor.
        shell.measure.blur();
        if (ui.guide) return app.placeGuide();
        if (ui.tool === 'wall') wallEvent(app, { kind: 'enter' });
        if (ui.tool === 'floor') floorFinish(app);
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
      if (!had && ui.guide) return cancelGuide(app);
      if (!had && ui.tool === 'modify') return app.modifyEvent({ kind: 'escape' });
      // An empty field has nothing to cancel: Esc acts on the drawing, as it does outside the field.
      if (!had && ui.tool === 'wall' && ui.wall.kind !== 'idle') return wallEvent(app, { kind: 'escape' });
      app.render();
    }
  });

  window.addEventListener('keyup', (e) => {
    // Shift let go: its lock goes with it.
    if (e.key === 'Shift' && ui.lock?.by === 'shift') {
      ui.lock = null;
      if (ptr.lastMove) onMove(ptr.lastMove);
    }
    if (e.key !== 'Alt') return;
    const target = e.target as HTMLElement;
    if (!target.closest('input, select, textarea')) e.preventDefault();
    const held = ptr.altAt !== null;
    ptr.altAt = null;
    if (!ui.guide) return;
    e.preventDefault();
    if (held && ptr.altMoved && shell.measure.value.trim() === '') app.placeGuide();
  });

  wireKeys(app, {
    pointer: ptr,
    gestures,
    guideTools,
    palette,
    showMarquee,
    // An arrow while drawing: held to x (→) or y (↑), or along (←) or square (↓) to the wall the snap
    // names or the nearest one; the same arrow again lets go.
    lock: (key) => {
      const from = ui.drawFrom;
      if (!from || !ptr.lastMove || ui.tool === 'select') return false;
      let dir: Point2;
      let label: MessageKey;
      let vars: Record<string, string | number> = {};
      if (key === 'arrowright' || key === 'arrowup') {
        dir = key === 'arrowright' ? { x: 1, y: 0 } : { x: 0, y: 1 };
        label = key === 'arrowright' ? 'lock.x' : 'lock.y';
      } else {
        const doc = app.store.get();
        const cursor = ui.cursor ?? from;
        const straight = doc.walls.filter((x) => x.levelId === ui.levelId && !x.bulge && distance(x.start, x.end) > 0);
        const named = ui.snap?.wallId ? straight.find((x) => x.id === ui.snap!.wallId) : undefined;
        const near = (x: (typeof straight)[number]) => {
          const u = normalize(sub(x.end, x.start));
          const t = Math.max(0, Math.min(distance(x.start, x.end), (cursor.x - x.start.x) * u.x + (cursor.y - x.start.y) * u.y));
          return distance(cursor, { x: x.start.x + u.x * t, y: x.start.y + u.y * t });
        };
        const wall = named ?? [...straight].sort((a, b) => near(a) - near(b))[0];
        if (!wall) {
          app.toast(t('lock.noWall'));
          return true;
        }
        const u = normalize(sub(wall.end, wall.start));
        dir = key === 'arrowleft' ? u : { x: -u.y, y: u.x };
        label = key === 'arrowleft' ? 'lock.parallel' : 'lock.square';
        vars = { n: wallNumber(doc, wall.id) ?? '' };
      }
      ui.lock = ui.lock?.label === label && ui.lock.by === 'arrow' ? null : { dir, label, vars, at: from, by: 'arrow' };
      onMove(ptr.lastMove);
      return true;
    },
    // Shift, drawing along a snapped direction (an angle, a wall's line, square to it): held to it.
    shiftLock: () => {
      const from = ui.drawFrom;
      const s = ui.snap;
      if (!from || !s || !ptr.lastMove || ui.lock || (s.kind !== 'angle' && s.kind !== 'parallel' && s.kind !== 'perpendicular')) return;
      const len = distance(from, s.point);
      if (len < 1e-6) return;
      ui.lock = { dir: { x: (s.point.x - from.x) / len, y: (s.point.y - from.y) / len }, label: 'lock.shift', vars: {}, at: from, by: 'shift' };
      onMove(ptr.lastMove);
    },
    // The snap offered is passed over and the pointer's place taken again: the next candidate.
    nextSnap: () => {
      const s = ui.snap;
      if (!s || !ptr.lastMove || ui.tool === 'select' || ui.drag) return false;
      ui.snapSkip = s.kind === 'grid' || s.kind === 'none' || s.kind === 'angle' ? [] : [...ui.snapSkip, s.point];
      ptr.tabAt = { x: ptr.lastMove.clientX, y: ptr.lastMove.clientY };
      onMove(ptr.lastMove);
      return true;
    },
  });
}
