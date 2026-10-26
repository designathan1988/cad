// Guides set from a wall's face or another guide (tools/guide-tool.ts): starting, moving, placing, dropping, clearing. Functions over the app (app.ts delegates).

import { parseLength } from '../core/measure';
import { type Point2 } from '../core/vector';
import { draftAt, type GuideBase, newGuide } from '../tools/guide-tool';
import { addGuide, clearGuides } from '../elements/guide/commands';
import { GUIDE_PREFIX, type Guide } from '../elements/guide/schema';
import { solidsOf } from '../elements/registry';
import { guideKind } from '../elements/kinds/guide';
import { newId } from '../core/id';
import type { App } from './app';

/** The guides of the level shown, unless hidden, as a move being dragged takes them. Plan only: they
 * are neither drawn nor snapped to in 3D. */
export function levelGuides(app: App): Guide[] {
  return app.ui.view === 'plan' ? solidsOf<Guide>(app.visibleGeometry().kinds, guideKind) : [];
}

/** Starts a guide off a wall's face or a guide, at the distance the pointer at p sets (guide-tool.ts). */
export function startGuide(app: App, base: GuideBase, p: Point2): void {
  app.ui.guide = draftAt(base, p, app.ui.snaps);
  // The point the tool snapped to before is not what a click does now: it places the guide.
  app.ui.snap = null;
  app.ui.error = null;
  app.ui.info = null;
  app.shell.measure.value = '';
  app.render();
}

export function moveGuide(app: App, p: Point2): void {
  if (!app.ui.guide) return;
  app.ui.guide = draftAt(app.ui.guide.base, p, app.ui.snaps);
  app.render();
}

/** The guide's distance: the one being typed, while it reads as one, else the pointer's. */
export function guideOffset(app: App): number | null {
  const g = app.ui.guide;
  if (!g) return null;
  const typed = parseLength(app.shell.measure.value);
  return typed.ok && typed.value >= 0 ? typed.value : g.offset;
}

/** Places the guide being set, as one undo step; the drawing tool goes on as it was. */
export function placeGuide(app: App, offset = app.guideOffset()): void {
  const g = app.ui.guide;
  if (!g || offset === null) return;
  app.ui.guide = null;
  app.shell.measure.value = '';
  app.store.dispatch(addGuide(newGuide(newId(GUIDE_PREFIX), app.ui.levelId, g, offset)));
}

export function cancelGuide(app: App): void {
  app.ui.guide = null;
  app.shell.measure.value = '';
  app.ui.error = null;
  app.render();
}

/** Every guide of the level shown, as one undo step. */
export function clearGuidesHere(app: App): void {
  app.store.dispatch(clearGuides(app.ui.levelId));
}
