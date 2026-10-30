// What is selected and what is done to it: all walls, the next one, the arrows, copy and paste, delete, select similar, hide or isolate for a while. Functions over the app (app.ts delegates).

import { clampMove, collisionFor } from './collision';
import { type Point2 } from '../model/vector';
import { deleteElements } from '../elements/opening/commands';
import { isGuideId } from '../elements/guide/schema';
import { name, t } from '../ui/i18n';
import { appendKinds, eachSolid, kindOfId } from '../elements/registry';
import { isDimId } from '../elements/dimension/schema';
import { isGridId } from '../elements/grid/schema';
import { isNoteId } from '../elements/note/schema';
import { stepSelection } from './keyboard-select';
import { nudge } from '../tools/nudge';
import { levelOf } from './document';
import { boundsOf, shownFor, type Category } from './geometry';
import { similarTo } from './select-similar';
import { canTransform, copyToLevel } from '../tools/transform';
import { newId } from '../core/id';
import type { App } from './app';

/** Every wall of the current level, with the select tool. */
export function selectAllWalls(app: App): void {
  app.setTool('select');
  // Hidden walls are not selected: nothing unseen can be deleted.
  if (app.ui.hidden.has('walls')) app.ui.info = t('hint.wallsHidden');
  else for (const w of app.store.get().walls) if (w.levelId === app.ui.levelId) app.ui.selection.add(w.id);
  app.refresh();
}

/**
 * Ctrl+A: everything the level shown shows (walls, doors and windows, rooms, the registry's kinds), as
 * the platform's Select All; what is hidden is not taken. It took the walls only (docs/revisao-interface.md, M8).
 */
export function selectAllShown(app: App): void {
  app.setTool('select');
  const level = app.ui.levelId;
  const g = app.visibleGeometry();
  const ids = [
    ...[...g.solids.values()].filter((s) => s.wall.levelId === level).map((s) => s.wall.id),
    ...[...g.openings.values()].filter((o) => g.solids.get(o.opening.wallId)?.wall.levelId === level).map((o) => o.opening.id),
    ...[...g.rooms.values()].filter((r) => r.room.levelId === level).map((r) => r.room.id),
    ...[...eachSolid(g.kinds)].filter((x) => x.levelId === level).map((x) => x.id),
  ];
  app.ui.selection = new Set(ids);
  app.refresh();
}

/**
 * The next (or previous) element of the level shown, as the selection: walls by number, then doors
 * and windows, rooms, floors (ref/chat.txt:242). In plan the view slides to show it.
 */
export function stepSelectionHere(app: App, dir: 1 | -1): void {
  app.setTool('select');
  const g = app.visibleGeometry();
  const order = [...eachSolid(g.kinds)].map((x) => x.id);
  const next = stepSelection(order, [...app.ui.selection], dir);
  if (!next) return;
  app.ui.selection = new Set([next]);
  if (app.ui.view === 'plan') {
    const box = boundsOf(app.geometry, app.ui.selection);
    const vp = app.shell.viewport.getBoundingClientRect();
    if (box) {
      const a = app.plan.toScreen({ x: box.min.x, y: box.max.y });
      const b = app.plan.toScreen({ x: box.max.x, y: box.min.y });
      const off = a.x < 0 || a.y < 0 || b.x > vp.width || b.y > vp.height;
      if (off) app.plan.panBy(vp.width / 2 - (a.x + b.x) / 2, vp.height / 2 - (a.y + b.y) / 2);
    }
  }
  app.refresh();
}

/** Moves the selection by a step from the keyboard (tools/nudge.ts): one undo step. */
export function nudgeSelection(app: App, step0: Point2): void {
  const doc = app.store.get();
  // With collisions on, things alone (no walls) stop at what they would go into.
  let step = step0;
  if (app.ui.collisions && ![...app.ui.selection].some((id) => doc.walls.some((w) => w.id === id))) {
    const c = collisionFor(app, app.ui.selection);
    step = clampMove(c.shapes, c.obstacles, step0);
    if (step.x === 0 && step.y === 0) return;
  }
  const next = nudge(doc, app.geometry, [...app.ui.selection], step);
  if (next !== doc) app.store.dispatch({ label: 'cmd.nudge', apply: () => next });
}

export function clearSelection(app: App): void {
  app.ui.selection.clear();
  app.refresh();
}

/**
 * Hides the selection for a while (Revit's HH), or isolates it (HI): the views leave out the rest.
 * Hiding again adds to what is hidden; with nothing selected, everything shows again (HR).
 */
export function hideTemporarily(app: App, mode: 'hide' | 'isolate'): void {
  const ids = [...app.ui.selection].filter((id) => !isGuideId(id) && !isNoteId(id) && !isDimId(id) && !isGridId(id));
  if (ids.length === 0) {
    if (app.ui.temp) app.resetTemporary();
    else {
      app.ui.info = t('hint.tempNothing');
      app.render();
    }
    return;
  }
  const was = app.ui.temp;
  app.ui.temp = mode === 'hide' && was?.mode === 'hide' ? { mode, ids: new Set([...was.ids, ...ids]) } : { mode, ids: new Set(ids) };
  // What went from view leaves the selection, as with a hidden category.
  if (mode === 'hide') for (const id of ids) app.ui.selection.delete(id);
  app.toast(t(mode === 'hide' ? 'toast.tempHidden' : 'toast.tempIsolated'));
  app.refresh();
}

/** Everything hidden or isolated for a while shows again. */
export function resetTemporary(app: App): void {
  if (!app.ui.temp) return;
  app.ui.temp = null;
  app.toast(t('toast.tempReset'));
  app.refresh();
}

/** Ctrl+C: the selection kept for Ctrl+V, which pastes it on another level in the same place. */
export function copySelection(app: App): void {
  const ids = [...app.ui.selection];
  if (!canTransform(app.store.get(), ids)) {
    app.ui.info = t('hint.copyNothing');
    return app.renderChrome();
  }
  app.clipboard = { doc: app.store.get(), geometry: app.geometry, ids, levelId: app.ui.levelId };
  app.toast(t(ids.length === 1 ? 'toast.copiedOne' : 'toast.copied', { n: ids.length }));
}

/**
 * Ctrl+V: what Ctrl+C took, on the level shown, in the same place (copyToLevel), as one undo step.
 * On the level it came from it would lie over itself: said, with the Copy tool to put it beside.
 */
export function paste(app: App): void {
  const c = app.clipboard;
  if (!c) {
    app.ui.info = t('hint.pasteNothing');
    return app.renderChrome();
  }
  if (c.levelId === app.ui.levelId) {
    app.ui.info = t('hint.pasteSameLevel');
    return app.renderChrome();
  }
  const r = copyToLevel(c.doc, c.geometry, c.ids, app.ui.levelId, newId);
  // Only axes taken: they are on app level already.
  if (r.selection.length === 0) {
    app.ui.info = t('hint.pasteAxes');
    return app.renderChrome();
  }
  const added = {
    walls: r.doc.walls.slice(c.doc.walls.length),
    openings: r.doc.openings.slice(c.doc.openings.length),
    openingGroups: r.doc.openingGroups.slice(c.doc.openingGroups.length),
    rooms: r.doc.rooms.slice(c.doc.rooms.length),
  };
  const level = levelOf(app.store.get(), app.ui.levelId);
  // The rooms renumbered on from the level's rooms as they are now, not as they were at the copy.
  let last = app.store.get().rooms.filter((x) => x.levelId === app.ui.levelId).reduce((n, x) => Math.max(n, Number.parseInt(x.number, 10) || 0), 0);
  const rooms = added.rooms.map((x) => ({ ...x, number: String(++last) }));
  app.store.dispatch({
    label: 'cmd.paste',
    // The registry's elements (columns, beams, roofs, stairs, guardrails) the copy added, too.
    apply: (d) => ({
      ...appendKinds(d, r.doc, c.doc),
      walls: [...d.walls, ...added.walls],
      openings: [...d.openings, ...added.openings],
      openingGroups: [...d.openingGroups, ...added.openingGroups],
      rooms: [...d.rooms, ...rooms],
    }),
  });
  app.ui.selection = new Set(r.selection);
  app.toast(t(r.selection.length === 1 ? 'toast.pastedOne' : 'toast.pasted', { n: r.selection.length, level: name(level?.name ?? '') }));
  app.refresh();
}

export function deleteSelection(app: App): void {
  const n = app.ui.selection.size;
  if (n === 0) return;
  app.store.dispatch(deleteElements([...app.ui.selection]));
  // Said, with the way back: the elements went without a word, and a window selection can take more than was seen.
  app.ui.info = t(n === 1 ? 'hint.deletedOne' : 'hint.deleted', { n });
  app.renderChrome();
}

/** Every wall of a type on the current level, with the select tool. */
/**
 * Everything on the level shown like what is selected (select-similar.ts), what shows only: a hidden
 * category or an element hidden for now is not taken.
 */
export function selectSimilar(app: App): void {
  if (app.ui.selection.size === 0) return;
  const doc = app.store.get();
  const temp = app.ui.temp;
  const hidden = app.ui.hidden;
  const category = (id: string): Category | null =>
    kindOfId(id)?.category ?? null;
  const ids = similarTo(doc, app.ui.selection, app.ui.levelId).filter((id) => {
    const c = category(id);
    return (c === null || !hidden.has(c)) && (!temp || shownFor(temp, id));
  });
  const added = ids.length - app.ui.selection.size;
  app.setTool('select');
  for (const id of ids) app.ui.selection.add(id);
  app.toast(t('toast.similar', { n: ids.length, added }));
  app.refresh();
}

export function selectWallsOfType(app: App, typeId: string): void {
  app.setTool('select');
  if (!app.ui.hidden.has('walls')) {
    for (const w of app.store.get().walls) if (w.wallTypeId === typeId && w.levelId === app.ui.levelId) app.ui.selection.add(w.id);
  }
  app.refresh();
}
