// Walking through the model at eye height: in and out, looking, the keys, the level, bumping into walls. Functions over the app (app.ts delegates).

import { lengthText } from '../ui/units';
import { type Point2 } from '../core/vector';
import { t } from '../ui/i18n';
import { savePrefs } from './persist';
import { EYE_MAX, EYE_MIN, MAX_PITCH, moveWithCollision, obstaclesOf, startPoint, stepFor } from './walk';
import type { App } from './app';
import { groundUnder } from '../elements/kinds/object';

/**
 * Walk mode on, at a point (where the user asked) or the middle of the level's largest room: in the 3D
 * view, at eye height, looking up the plan. Off again with Esc, the camera as it was.
 */
export function enterWalk(app: App, at?: Point2): void {
  const start = at ?? startPoint(app.visibleGeometry(), app.ui.levelId);
  if (!start) {
    app.ui.info = t('hint.walkNothing');
    return app.renderChrome();
  }
  app.ui.drag = null;
  // A tour going on would fly the camera off to its next stop: walking ends it, as a tour ends a walk.
  app.stopTour();
  app.setTool('select');
  app.ui.selection.clear();
  app.setView('3d');
  app.scene.startWalk();
  app.walker = { x: start.x, y: start.y, levelId: app.ui.levelId, yaw: Math.PI / 2, pitch: 0 };
  app.placeWalker();
  app.walkKeys.clear();
  app.walkLast = performance.now();
  cancelAnimationFrame(app.walkFrame);
  app.walkFrame = requestAnimationFrame((now) => app.walkTick(now));
  app.toast(t('toast.walk', { h: lengthText(app.eyeHeight) }));
  app.render();
}

export function exitWalk(app: App): void {
  if (!app.walker) return;
  app.walker = null;
  app.walkKeys.clear();
  cancelAnimationFrame(app.walkFrame);
  app.scene.endWalk();
  app.render();
}

export function toggleWalk(app: App): void {
  if (app.walker) app.exitWalk();
  else app.enterWalk();
}

/** The eyes higher or lower by `step` (m), within EYE_MIN..EYE_MAX; said in the footer. */
export function walkEye(app: App, step: number): void {
  app.eyeHeight = Math.round(Math.min(EYE_MAX, Math.max(EYE_MIN, app.eyeHeight + step)) * 100) / 100;
  savePrefs({ eyeHeight: app.eyeHeight });
  app.placeWalker();
  app.renderChrome();
}

/** Turns the view: a drag of dx, dy pixels. */
export function walkLook(app: App, dx: number, dy: number): void {
  const w = app.walker;
  if (!w) return;
  app.walker = { ...w, yaw: w.yaw - dx * 0.004, pitch: Math.max(-MAX_PITCH, Math.min(MAX_PITCH, w.pitch - dy * 0.004)) };
  app.placeWalker();
}

/** To the level above (+1) or below (−1), at the same point of the plan. */
export function walkLevel(app: App, step: 1 | -1): void {
  const w = app.walker;
  if (!w) return;
  const levels = [...app.store.get().levels].sort((a, b) => a.elevation - b.elevation);
  const k = levels.findIndex((l) => l.id === w.levelId) + step;
  const next = levels[k];
  if (!next) return;
  app.walker = { ...w, levelId: next.id };
  app.setLevel(next.id);
  app.placeWalker();
}

export function walkTick(app: App, now: number): void {
  const w = app.walker;
  if (!w) return;
  const seconds = Math.min(0.1, (now - app.walkLast) / 1000);
  app.walkLast = now;
  const k = app.walkKeys;
  const stick = app.walkStick;
  const forward = stick?.forward ?? (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const side = stick?.side ?? (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  if (forward !== 0 || side !== 0) {
    // The stick moves as far as it is pushed; full out it walks.
    const push = stick ? Math.min(1, Math.hypot(forward, side)) : 1;
    const d = stepFor(w, forward, side, seconds * push, k.has('shift'));
    // Through everything when the walker asked to (C), else stopped by it.
    const p = app.walkThrough ? { x: w.x + d.x, y: w.y + d.y } : moveWithCollision({ x: w.x, y: w.y }, d, app.obstaclesHere(w.levelId));
    app.walker = { ...w, x: p.x, y: p.y };
    app.placeWalker();
  }
  app.walkFrame = requestAnimationFrame((t2) => app.walkTick(t2));
}

/** The walls that stop the walker on a level, again only when the walls change. */
export function obstaclesHere(app: App, levelId: string): ReturnType<typeof obstaclesOf> {
  const c = app.walkObstacles;
  if (c && c.from === app.geometry && c.levelId === levelId) return c.list;
  const floor = app.store.get().levels.find((l) => l.id === levelId)?.elevation ?? 0;
  const list = obstaclesOf(app.geometry, levelId, floor);
  app.walkObstacles = { from: app.geometry, levelId, list };
  return list;
}

/** The camera at the walker's eyes: over the level's floor, or out of doors over the terrain under the feet. */
export function placeWalker(app: App): void {
  const w = app.walker;
  if (!w) return;
  const doc = app.store.get();
  const floor = doc.levels.find((l) => l.id === w.levelId)?.elevation ?? 0;
  const ground = groundUnder(doc, app.geometry, w.levelId, w) ?? floor;
  app.scene.setWalkView({ x: w.x, y: w.y, z: ground + app.lift(w.levelId) + app.eyeHeight }, w.yaw, w.pitch);
}

/** Walking through walls and things, or stopped by them (C while walking); said in a toast. */
export function toggleWalkThrough(app: App): void {
  app.walkThrough = !app.walkThrough;
  app.toast(t(app.walkThrough ? 'toast.walkThrough' : 'toast.walkSolid'));
  app.renderChrome();
}
