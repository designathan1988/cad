// Guides set from a wall's face or another guide (tools/guide-tool.ts): starting, moving, placing, dropping, clearing. Functions over the app (app.ts delegates).

import { t } from '../../i18n/messages';
import { parseLength } from '../../core/measure';
import { type Point2, distance, normalize, sub } from '../../model/vector';
import { draftAt, type GuideBase, newGuide } from './tool';
import { addGuide, clearGuides } from './commands';
import { isLineGuide, newGuideId, type Guide } from './schema';
import { solidsOf } from '../registry';
import { guideKind } from '../kinds/guide';
import type { App } from '../../session/app';

/** The guides of the level shown, unless hidden, as a move being dragged takes them. Plan only: they
 * are neither drawn nor snapped to in 3D. */
export type GuideMode = 'line' | 'point' | 'circle';

/** The guide tool in one of its modes: a line by two points, a point, or a circle by centre and radius. */
export function setGuideTool(app: App, mode: GuideMode): void {
  app.setTool('guide');
  app.ui.guideMode = mode;
  app.ui.guideFrom = null;
  app.render();
}

/** A click with the guide tool: a point guide at once; a line's or a circle's first point, then the guide. */
export function guideClick(app: App, p: Point2): void {
  const ui = app.ui;
  const make = (g: Omit<Guide, 'id' | 'levelId'>) => {
    app.store.dispatch(addGuide({ id: newGuideId(), levelId: ui.levelId, ...g }));
    ui.guideFrom = null;
    ui.info = t('hint.guideMade');
    app.render();
  };
  if (ui.guideMode === 'point') return make({ point: { x: p.x, y: p.y }, dir: { x: 1, y: 0 }, shape: 'point' });
  const from = ui.guideFrom;
  if (!from) {
    ui.guideFrom = p;
    ui.info = null;
    return app.render();
  }
  if (distance(from, p) < MIN_GUIDE_RUN) return;
  if (ui.guideMode === 'circle') return make({ point: from, dir: { x: 1, y: 0 }, shape: 'circle', radius: distance(from, p) });
  return make({ point: from, dir: normalize(sub(p, from)) });
}

/** A circle guide's radius typed, from its centre. */
export function guideRadius(app: App, radius: number): boolean {
  const from = app.ui.guideFrom;
  if (app.ui.tool !== 'guide' || app.ui.guideMode !== 'circle' || !from || radius < MIN_GUIDE_RUN) return false;
  app.store.dispatch(addGuide({ id: newGuideId(), levelId: app.ui.levelId, point: from, dir: { x: 1, y: 0 }, shape: 'circle', radius }));
  app.ui.guideFrom = null;
  app.ui.info = t('hint.guideMade');
  app.render();
  return true;
}

/** Two points nearer than this make no guide (m). */
const MIN_GUIDE_RUN = 0.01;

/** The level's line guides shown (a point's or a circle's are guideShapes'). */
export function levelGuides(app: App): Guide[] {
  return app.ui.view === 'plan' ? solidsOf<Guide>(app.visibleGeometry().kinds, guideKind).filter(isLineGuide) : [];
}

/** The level's point and circle guides shown: points to snap to, circles to snap onto. */
export function guideShapes(app: App): { points: { point: Point2; kind: 'center' | 'node' }[]; circles: { center: Point2; radius: number }[] } {
  const all = app.ui.view === 'plan' ? solidsOf<Guide>(app.visibleGeometry().kinds, guideKind) : [];
  return {
    points: all.flatMap((g): { point: Point2; kind: 'center' | 'node' }[] => (g.shape === 'point' ? [{ point: g.point, kind: 'node' }] : g.shape === 'circle' ? [{ point: g.point, kind: 'center' }] : [])),
    circles: all.flatMap((g) => (g.shape === 'circle' ? [{ center: g.point, radius: g.radius! }] : [])),
  };
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
export function placeGuide(app: App, offset = guideOffset(app)): void {
  const g = app.ui.guide;
  if (!g || offset === null) return;
  app.ui.guide = null;
  app.shell.measure.value = '';
  app.store.dispatch(addGuide(newGuide(newGuideId(), app.ui.levelId, g, offset)));
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
