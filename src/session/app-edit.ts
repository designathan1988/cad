// Editing through the session: undo and redo (a wall chain step back first), the level shown, arranging,
//  the measure and mark modes, automatic dimensions and a section at a guide.

import type { App } from './app';
import type { MarkMode } from './state';
import { autoDimensions } from '../elements/dimension/auto';
import { addDimensions } from '../elements/dimension/commands';
import { arrangeNeeds, arrangeSteps, type ArrangeHow } from '../tools/arrange';
import * as viewing from './view-ui';
import { distance } from '../model/vector';
import { t, type MessageKey } from '../i18n/messages';
import { MEASURE_IDLE } from '../elements/measure/tool';
import { moveKinds } from '../elements/registry';
import { deriveGeometry } from '../project/derive';
import { savePrefs } from '../project/persist';
import { newId } from '../core/id';

/** Backspace while drawing a chain: its last wall undone, the chain going on from its start. */
export function undoChainStep(app: App): boolean {
  return chainStepBack(app);
}

// Said with what was undone or redone ("Undone: Delete"): "Undone" alone left the user to look for it.
export function undo(app: App): void {
  if (chainStepBack(app)) return;
  const what = app.store.undoLabel();
  if (app.store.undo()) app.toast(what ? `${t('toast.undo')}: ${t(what as MessageKey)}` : t('toast.undo'), { label: t('toast.redoBtn'), run: () => redo(app) });
}

export function redo(app: App): void {
  const what = app.store.redoLabel();
  if (app.store.redo()) app.toast(what ? `${t('toast.redo')}: ${t(what as MessageKey)}` : t('toast.redo'), { label: t('toast.undoBtn'), run: () => undo(app) });
}

/** Shows another level in plan; the selection, which belonged to the old one, is cleared. */
export function setLevel(app: App, id: string): void {
  if (!app.store.get().levels.some((l) => l.id === id)) return;
  // A saved view's own scale was its level's: another level is drawn at the project's.
  if (id !== app.ui.levelId) app.ui.viewDen = null;
  app.ui.levelId = id;
  savePrefs({ levelId: id });
  app.ui.selection.clear();
  app.ui.guide = null;
  // A message about the level left ("already on app level") would be read as about app one.
  app.ui.info = null;
  app.ui.error = null;
  app.refresh();
}

/** Align or distribute the selection, one step to undo; said when there are too few to. */
export function arrange(app: App, how: ArrangeHow): void {
  const items = app.arrangeItems();
  if (items.length < arrangeNeeds(how)) return app.toast(t('arrange.needs', { n: arrangeNeeds(how) }));
  const steps = arrangeSteps(
    items.map((i) => i.box),
    how,
  );
  const before = app.store.get();
  const next = items.reduce((d, it, i) => moveKinds(d, new Set([it.id]), steps[i]!), before);
  if (next !== before) app.store.dispatch({ label: 'cmd.arrange', apply: () => next });
}

/** The measure tool between two points and a chain (C): the tape so far is dropped. */
export function toggleMeasureMode(app: App): void {
  app.ui.measureMode = app.ui.measureMode === 'chain' ? 'distance' : 'chain';
  app.ui.measure = MEASURE_IDLE;
  app.toast(t(app.ui.measureMode === 'chain' ? 'toast.measureChain' : 'toast.measureDistance'));
  app.render();
}

/** The measure tool, measuring an angle, an arc wall or a point's coordinates. */
export function setMarkMode(app: App, mode: MarkMode): void {
  app.setTool('mark');
  app.ui.markMode = mode;
  app.render();
}

/**
 * Automatic dimensioning (elements/dimension/auto.ts): chains along the selected walls' outer faces,
 * or along every outer wall of the level when no wall is selected.
 */
export function autoDimension(app: App): void {
  const doc = app.store.get();
  const ids = [...app.ui.selection].filter((id) => doc.walls.some((w) => w.id === id && w.levelId === app.ui.levelId));
  const dims = autoDimensions(doc, deriveGeometry(doc), app.ui.levelId, ids.length > 0 ? ids : null, newId);
  if (dims.length === 0) return app.toast(t('dim.autoNone'));
  app.store.dispatch(addDimensions(dims));
  app.toast(t('dim.autoMade', { n: dims.length }));
}

/**
 * A vertical section through the selected guide (Revit's Section): the 3D keeps what lies on one side
 * of it, its cut filled, seen square and parallel from the other. `flip`: the other side.
 */
export function sectionAtGuide(app: App, flip = false): void {
  return viewing.sectionAtGuide(app, flip);
}

/**
 * Drawing a chain, the last step to undo is its last wall: undone, the chain goes on from where that
 * wall began (ArchiCAD's Backspace), instead of from the end of a wall that is gone. False otherwise.
 */
export function chainStepBack(app: App): boolean {
  const w = app.ui.wall;
  const last = app.store.get().walls.at(-1);
  if (app.ui.tool !== 'wall' || w.kind !== 'drawing' || w.count === 0 || app.store.undoLabel() !== 'cmd.addWalls' || !last) return false;
  if (distance(last.end, w.last) > 1e-9) return false;
  if (!app.store.undo()) return false;
  app.ui.wall = { ...w, last: last.start, cursor: last.start, count: w.count - 1 };
  app.shell.measure.value = '';
  app.refresh();
  app.toast(`${t('toast.undo')}: ${t('cmd.addWalls')}`);
  return true;
}
