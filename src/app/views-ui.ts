// Saved views and the tour through them: saving, going to one, deleting, playing. Functions over the app (app.ts delegates).

import { name, t } from '../ui/i18n';
import { savePrefs } from './persist';
import { deleteView, nextViewName, type SavedView, saveView } from './saved-views';
import { readView3D } from './view-3d';
import { newId } from '../core/id';
import type { App } from './app';
import { drawingOf } from './document';

/**
 * The view as it is now, saved in the project under the next free name ("3D 1", "Térreo 1"): the 3D
 * camera and what the 3D shows, or the plan's level, zoom and position.
 */
export function saveCurrentView(app: App): void {
  const doc = app.store.get();
  const level = doc.levels.find((l) => l.id === app.ui.levelId);
  const id = newId('view');
  let view: SavedView;
  if (app.ui.view === '3d') {
    const p = app.scene.camera.position;
    const q = app.scene.controls.target;
    view = { id, kind: '3d', name: nextViewName(doc.views, '3D'), levelId: app.ui.levelId, position: [p.x, p.y, p.z], target: [q.x, q.y, q.z], view3d: app.ui.view3d };
  } else {
    const c = app.plan.center;
    // Its drawing scale as it is shown now: a saved view's own, else the project's.
    view = { id, kind: 'plan', name: nextViewName(doc.views, level ? name(level.name) : t('view.plan')), levelId: app.ui.levelId, scale: app.plan.scale, center: { x: c.x, y: c.y }, den: app.ui.viewDen ?? drawingOf(doc).scale };
  }
  // What it shows goes with it: a view template (the categories hidden, the overrides on).
  app.store.dispatch(saveView({ ...view, hidden: [...app.ui.hidden], overrides: app.ui.overridesOn }));
  app.toast(t('toast.viewSaved', { name: view.name }));
}

/** Back to a saved view: its level, and its camera or its plan framing. Not an undo step. */
export function goToView(app: App, id: string): void {
  const v = app.store.get().views.find((x) => x.id === id);
  if (!v) return;
  if (v.levelId !== app.ui.levelId) app.setLevel(v.levelId);
  // As it was saved showing: its categories, its overrides (a view saved before these shows all).
  if (v.hidden) app.ui.hidden = new Set(v.hidden);
  if (v.overrides !== undefined) app.ui.overridesOn = v.overrides;
  if (v.kind === '3d') {
    // Read as stored views are: a file's view may hold anything.
    app.ui.view3d = readView3D(v.view3d);
    savePrefs({ view3d: app.ui.view3d });
    app.setView('3d');
    app.framed['3d'] = true;
    app.scene.camera.position.set(...v.position);
    app.scene.controls.target.set(...v.target);
    app.scene.camera.up.set(0, 1, 0);
    app.scene.controls.update();
    app.scene.invalidate();
  } else {
    app.setView('plan');
    app.framed.plan = true;
    app.plan.scale = v.scale;
    app.plan.center = { x: v.center.x, y: v.center.y };
    // Its own drawing scale and detail, for as long as it is the one shown (app.ts: drawingNow).
    app.ui.viewDen = v.den ?? null;
  }
  app.refresh();
}

export function deleteSavedView(app: App, id: string): void {
  app.store.dispatch(deleteView(id));
}

export function setTourSeconds(app: App, s: number): void {
  app.tourSeconds = Math.max(1, Math.round(s));
  savePrefs({ tourSeconds: app.tourSeconds });
}

/** The tour from a stop (the first by default), going on by itself. */
export function playTour(app: App, from = 0): void {
  const views = app.store.get().views;
  if (views.length === 0) {
    app.ui.info = t('gtour.none');
    return app.renderChrome();
  }
  app.exitWalk();
  app.tour = { index: Math.max(0, Math.min(from, views.length - 1)), playing: true };
  app.showStop();
}

/** The next (+1) or the previous (−1) stop; past the last, the tour ends; it keeps playing or paused. */
export function tourStep(app: App, step: 1 | -1): void {
  const tour = app.tour;
  if (!tour) return;
  const n = app.store.get().views.length;
  const index = tour.index + step;
  if (index >= n) return app.stopTour();
  app.tour = { ...tour, index: Math.max(0, index) };
  app.showStop();
}

export function tourPause(app: App): void {
  const tour = app.tour;
  if (!tour) return;
  app.tour = { ...tour, playing: !tour.playing };
  clearTimeout(app.tourTimer);
  if (app.tour.playing) app.tourTimer = window.setTimeout(() => app.tourStep(1), app.tourSeconds * 1000);
  app.renderChrome();
}

export function stopTour(app: App): void {
  if (!app.tour) return;
  app.tour = null;
  clearTimeout(app.tourTimer);
  app.scene.stopFlight();
  app.renderChrome();
}

/** The stop the tour is at: flown to in 3D, gone to in plan; the next one after its time. */
export function showStop(app: App): void {
  const tour = app.tour;
  const v = tour ? app.store.get().views[tour.index] : undefined;
  if (!tour || !v) return app.stopTour();
  clearTimeout(app.tourTimer);
  const FLY = 1200;
  if (v.kind === '3d') {
    if (v.levelId !== app.ui.levelId) app.setLevel(v.levelId);
    app.ui.view3d = readView3D(v.view3d);
    app.setView('3d');
    app.framed['3d'] = true;
    app.scene.flyTo(v.position, v.target, FLY);
    app.refresh();
  } else app.goToView(v.id);
  if (tour.playing) app.tourTimer = window.setTimeout(() => app.tourStep(1), app.tourSeconds * 1000 + (v.kind === '3d' ? FLY : 0));
  app.renderChrome();
}
