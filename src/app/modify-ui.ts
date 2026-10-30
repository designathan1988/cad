// The Modify tools (move, copy, rotate, mirror, scale, offset) and splitting, cornering and merging walls. Functions over the app (app.ts delegates).

import { angleNum, lengthText, typingExamples } from '../i18n/units';
import { distance, type Point2, scale } from '../model/vector';
import { setWalls } from '../elements/wall/commands';
import { num, t, type MessageKey } from '../i18n/messages';
import { wallNumber } from '../project/doc';
import { boundsOf, deriveGeometry } from '../project/derive';
import { MODIFY_START, type ModifyEvent, type ModifyKind, modifyTransition, previewTransform } from '../tools/modify-tool';
import { canTransform, copiesInSeries, transformSelection } from '../tools/transform';
import { canMerge, cornerWalls, mergeWalls, splitWall } from '../tools/split';
import { newId } from '../core/id';
import type { App } from './app';

/** Starts Move, Copy, Rotate, Scale or Mirror on the selection; said why not when there is nothing they take. */
export function startModify(app: App, kind: ModifyKind): void {
  const doc = app.store.get();
  if (!canTransform(doc, [...app.ui.selection])) {
    app.ui.info = t('hint.modifyNothing');
    return app.renderChrome();
  }
  // Offset is measured across a straight wall of the selection: its first.
  const straight = doc.walls.find((w) => app.ui.selection.has(w.id) && !w.bulge);
  if (kind === 'offset' && !straight) {
    app.ui.info = t('hint.offsetNoWall');
    return app.renderChrome();
  }
  const selection = new Set(app.ui.selection);
  app.setTool('select');
  app.ui.selection = selection;
  app.ui.tool = 'modify';
  // Copy copies; a mirror makes a mirrored copy as Revit's does, and so does an offset (C changes them).
  app.ui.modify = {
    kind,
    copy: kind === 'copy' || kind === 'mirror' || kind === 'offset',
    disjoin: false,
    state: MODIFY_START,
    ...(kind === 'offset' && straight ? { line: { start: straight.start, end: straight.end } } : {}),
  };
  app.modifyBefore = deriveGeometry(doc);
  app.refresh();
}

/** C in a Modify tool: copy, or take the originals. */
export function toggleModifyCopy(app: App): void {
  const m = app.ui.modify;
  if (!m) return;
  app.ui.modify = { ...m, copy: !m.copy };
  app.refresh();
}

/** U in Move: the walls alone, leaving their joins (Revit's Disjoin), or with them. */
export function toggleModifyDisjoin(app: App): void {
  const m = app.ui.modify;
  if (!m || m.kind !== 'move') return;
  app.ui.modify = { ...m, disjoin: !m.disjoin };
  app.refresh();
}

/** A click, a typed value or Esc in a Modify tool (modify-tool.ts); the transform, when done, is one undo step. */
export function modifyEvent(app: App, event: ModifyEvent): void {
  const m = app.ui.modify;
  if (!m) return;
  const r = modifyTransition(m.kind, m.state, event, app.ui.snap?.point ?? app.ui.cursor, m.line);
  if (r.leave) return app.setTool('select');
  if (r.rejected) {
    if (event.kind === 'typed') app.ui.error = t('hint.badMeasure', { ...typingExamples(), text: app.shell.measure.value });
    return app.renderChrome();
  }
  app.ui.error = null;
  app.shell.measure.value = '';
  if (!r.apply) {
    app.ui.modify = { ...m, state: r.state };
    return app.refresh();
  }
  const doc = app.store.get();
  const geometry = app.modifyBefore ?? deriveGeometry(doc);
  const ids = [...app.ui.selection];
  const result = transformSelection(doc, geometry, ids, r.apply, m.copy, newId, m.disjoin);
  const label = m.kind === 'move' && m.copy ? 'cmd.copy' : (`cmd.${m.kind}` as MessageKey);
  app.ui.tool = 'select';
  app.ui.modify = null;
  app.modifyBefore = null;
  app.ui.snap = null;
  app.ui.selection = new Set(result.selection);
  app.store.dispatch({ label, apply: () => result.doc });
  // A copy moved by a step: typing "3x" or "/3" next makes a series of it (copySeries).
  const origin = { x: 0, y: 0 };
  const delta = r.apply.map(origin);
  const moved = (m.kind === 'move' || m.kind === 'copy' || m.kind === 'offset') && m.copy && distance(delta, origin) > 0;
  app.lastCopy = moved ? { before: doc, geometry, ids, delta, after: app.store.get(), selected: result.selection } : null;
  if (moved) {
    app.ui.info = t('hint.seriesOffer');
    app.renderChrome();
  }
  // A parametric object keeps its size in a scale (its sizes are its parameters, with their rules): said,
  // or the scale seemed to do nothing to a table.
  if (m.kind === 'scale' && ids.some((id) => doc.objects.some((o) => o.id === id))) {
    app.ui.info = t('hint.scaleObjects');
    app.renderChrome();
  }
}

/**
 * Whether "3x" or "/3" typed now would make a series of the last copy: nothing changed since, and the
 * copy still the selection (another click gives the digits back to the view keys).
 */
export function seriesReady(app: App): boolean {
  const c = app.lastCopy;
  return c !== null && app.store.get() === c.after && c.selected.length === app.ui.selection.size && c.selected.every((id) => app.ui.selection.has(id));
}

/**
 * The last copy made a series, as SketchUp's Move-copy and Revit's Array: `n` copies one after
 * another at its step ("3x"), or, `divide`, `n` copies spread evenly from the original to where the
 * copy went ("/3"). It replaces the copy: one undo step, the last copy of the series selected.
 */
export function copySeries(app: App, n: number, divide: boolean): boolean {
  const c = app.lastCopy;
  if (!c || !app.seriesReady()) {
    app.ui.error = t('hint.seriesAfterCopy');
    app.renderChrome();
    return false;
  }
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    app.ui.error = t('hint.seriesCount');
    app.renderChrome();
    return false;
  }
  const step = divide ? scale(c.delta, 1 / n) : c.delta;
  const { doc: series, selection: last } = copiesInSeries(c.before, c.geometry, c.ids, c.delta, n, divide, newId);
  app.store.undo();
  app.store.dispatch({ label: 'cmd.series', apply: () => series });
  app.lastCopy = { ...c, after: app.store.get(), selected: last };
  app.ui.selection = new Set(last);
  app.ui.error = null;
  app.ui.info = t('hint.seriesDone', { n, d: lengthText(Math.hypot(step.x, step.y)) });
  app.refresh();
  return true;
}

/** The Split tool: the wall under the point divided there (tools/split.ts), as one undo step. */
export function splitAt(app: App, point: Point2, wallId: string | undefined): void {
  const doc = app.store.get();
  if (!wallId || !doc.walls.some((w) => w.id === wallId)) {
    app.ui.info = t('hint.splitNoWall');
    return app.renderChrome();
  }
  const id = newId('wall');
  const r = splitWall(doc, wallId, point, id);
  if (typeof r === 'string') {
    app.ui.error = t(r === 'throughOpening' ? 'hint.splitThroughOpening' : 'hint.splitTooShort');
    return app.renderChrome();
  }
  app.ui.error = null;
  app.store.dispatch({ label: 'cmd.split', apply: () => r });
  // The cut leaves no mark on the plan (the two parts join where it was): said, or it looked as if
  // the click had done nothing.
  app.ui.info = t('hint.splitDone', { n: wallNumber(r, wallId) ?? '', m: wallNumber(r, id) ?? '' });
  app.renderChrome();
}

/** The Corner tool: the first wall clicked, then the second, met at the corner of their lines. */
export function cornerClick(app: App, wallId: string | null): void {
  const doc = app.store.get();
  if (!wallId || !doc.walls.some((w) => w.id === wallId)) {
    app.ui.info = t('hint.cornerNoWall');
    return app.renderChrome();
  }
  const first = [...app.ui.selection][0];
  if (!first || first === wallId) {
    app.ui.selection = new Set([wallId]);
    app.ui.error = null;
    return app.refresh();
  }
  const walls = cornerWalls(doc, first, wallId);
  app.ui.selection.clear();
  if (!walls) {
    app.ui.error = t('hint.cornerNone');
    return app.refresh();
  }
  app.ui.error = null;
  app.store.dispatch(setWalls(walls, 'cmd.corner'));
  app.ui.info = t('hint.cornerDone', { a: wallNumber(doc, first) ?? '', b: wallNumber(doc, wallId) ?? '' });
  app.renderChrome();
}

/** Two walls in line, end to end, of one type, joined into one (tools/split.ts). */
export function mergeSelection(app: App): void {
  const ids = app.selectedWalls().map((w) => w.id);
  const doc = app.store.get();
  if (ids.length !== 2) return;
  const next = mergeWalls(doc, ids[0]!, ids[1]!);
  if (!next) {
    app.ui.info = t('hint.mergeNot');
    return app.renderChrome();
  }
  app.ui.selection = new Set([ids[0]!]);
  app.store.dispatch({ label: 'cmd.merge', apply: () => next });
  app.ui.info = t('hint.mergeDone', { n: wallNumber(next, ids[0]!) ?? '' });
  app.renderChrome();
}

/** Whether the selection is two walls that can be joined into one. */
export function canMergeSelection(app: App): boolean {
  const ids = app.selectedWalls().map((w) => w.id);
  return ids.length === 2 && canMerge(app.store.get(), ids[0]!, ids[1]!);
}

/** The middle of the selection's extent: the centre a turn, a scale or a mirror takes on Enter. */
export function selectionCentre(app: App): Point2 | null {
  const box = boundsOf(app.geometry, app.ui.selection);
  const guides = app.store.get().guides.filter((x) => app.ui.selection.has(x.id));
  if (box) return { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
  return guides[0]?.point ?? null;
}

/**
 * What a Modify tool shows: its base, the line to the pointer, the reference of an angle or a scale,
 * a mirror's axis, and the value it would apply.
 */
export function modifyMarks(app: App): { base: Point2; to: Point2 | null; ref: Point2 | null; axis: { point: Point2; dir: Point2 } | null; text: string | null } | null {
  const m = app.ui.modify;
  if (app.ui.tool === 'modify' && m?.kind === 'offset' && m.line) {
    // From the wall's line, square to it, to the pointer: the distance the copy goes.
    const to = app.ui.snap?.point ?? app.ui.cursor;
    if (!to) return null;
    const u = { x: m.line.end.x - m.line.start.x, y: m.line.end.y - m.line.start.y };
    const len2 = u.x * u.x + u.y * u.y;
    const along = ((to.x - m.line.start.x) * u.x + (to.y - m.line.start.y) * u.y) / len2;
    const foot = { x: m.line.start.x + u.x * along, y: m.line.start.y + u.y * along };
    return { base: foot, to, ref: null, axis: null, text: `${lengthText(distance(foot, to))}` };
  }
  if (app.ui.tool !== 'modify' || !m || m.state.step === 'base') return null;
  const base = m.state.base;
  const to = app.ui.snap?.point ?? app.ui.cursor;
  const ref = m.state.step === 'third' ? m.state.ref : null;
  const tr = previewTransform(m.kind, m.state, to, m.line);
  const deg = (v: Point2) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
  let text: string | null = null;
  if (to) {
    if (m.kind === 'move' || m.kind === 'copy') text = `${lengthText(distance(base, to))}`;
    else if (m.kind === 'rotate' && ref) text = `${angleNum(((((deg({ x: to.x - base.x, y: to.y - base.y }) - deg({ x: ref.x - base.x, y: ref.y - base.y })) % 360) + 540) % 360) - 180)}°`;
    else if (m.kind === 'scale' && ref) text = tr ? `× ${num(tr.factor, 3)}` : null;
    else if (m.kind === 'scale' || m.kind === 'rotate') text = `${lengthText(distance(base, to))}`;
    else if (m.kind === 'mirror') text = `${angleNum((deg({ x: to.x - base.x, y: to.y - base.y }) + 360) % 180)}°`;
  }
  const len = to ? distance(base, to) : 0;
  const axis = m.kind === 'mirror' && to && len > 1e-9 ? { point: base, dir: { x: (to.x - base.x) / len, y: (to.y - base.y) / len } } : null;
  return { base, to, ref, axis, text };
}
