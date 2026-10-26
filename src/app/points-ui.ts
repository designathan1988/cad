// Points of interest on the plan and in 3D: adding one, where they show, the card of one. Functions over the app (app.ts delegates).

import { type Point2 } from '../core/vector';
import { t } from '../ui/i18n';
import { addPoint, POINT_HEIGHT } from './points';
import { POINT_DISC_R } from '../render/plan-view';
import { shownLevels } from './view-3d';
import { newId } from '../core/id';
import type { App } from './app';

/** A point of interest where the menu was opened (or the middle of the view), its card open to edit. */
export function addPointHere(app: App, at?: Point2): void {
  const doc = app.store.get();
  const p = at ?? app.plan.center;
  const id = newId('poi');
  app.store.dispatch(addPoint({ id, levelId: app.ui.levelId, point: { x: p.x, y: p.y }, title: t('poi.defaultTitle', { n: doc.points.length + 1 }) }));
  app.openPointId = id;
  app.openPoints();
}

/** The points of the level shown (all levels in 3D), numbered as in the document, where they are drawn. */
export function pointsShown(app: App): { id: string; n: number; at: Point2; z: number; open: boolean }[] {
  const doc = app.store.get();
  const shown3d = app.ui.view === '3d' ? shownLevels(doc.levels, app.ui.levelId, app.ui.view3d.levels) : null;
  return doc.points.flatMap((p, k) => {
    if (shown3d ? !shown3d.has(p.levelId) : p.levelId !== app.ui.levelId) return [];
    const level = doc.levels.find((l) => l.id === p.levelId);
    const z = (level?.elevation ?? 0) + app.lift(p.levelId) + POINT_HEIGHT;
    return [{ id: p.id, n: k + 1, at: p.point, z, open: p.id === app.openPointId }];
  });
}

/** The point of interest whose disc is at a screen point (client coordinates), or null. */
export function pointAtHere(app: App, clientX: number, clientY: number): string | null {
  const r = app.shell.viewport.getBoundingClientRect();
  for (const p of app.pointsShown()) {
    const s = app.ui.view === 'plan' ? app.plan.toScreen(p.at) : app.projectAt(p.at, p.z);
    if (!s) continue;
    const sx = app.ui.view === 'plan' ? s.x : s.x + r.left;
    const sy = app.ui.view === 'plan' ? s.y : s.y + r.top;
    const cx = app.ui.view === 'plan' ? clientX - r.left : clientX;
    const cy = app.ui.view === 'plan' ? clientY - r.top : clientY;
    if (Math.hypot(sx - cx, sy - cy) <= POINT_DISC_R + 3) return p.id;
  }
  return null;
}

/** A point's card opened (or closed with null). */
export function showPoint(app: App, id: string | null): void {
  app.openPointId = id;
  app.render();
}

/** The open point's card: its title and text, beside its disc; hidden when none is open or it is off screen. */
export function placePointCard(app: App): void {
  const { shell } = app;
  const doc = app.store.get();
  const k = doc.points.findIndex((p) => p.id === app.openPointId);
  const p = doc.points[k];
  const shown = p ? app.pointsShown().find((x) => x.id === p.id) : undefined;
  const s = shown ? (app.ui.view === 'plan' ? app.plan.toScreen(shown.at) : app.projectAt(shown.at, shown.z)) : null;
  shell.pointCard.hidden = !p || !s;
  if (!p || !s) return;
  shell.pointTitle.textContent = `${k + 1} · ${p.title}`;
  shell.pointText.textContent = p.text ?? '';
  shell.pointText.hidden = !p.text;
  shell.pointCard.style.left = `${Math.round(s.x + POINT_DISC_R + 8)}px`;
  shell.pointCard.style.top = `${Math.round(s.y - POINT_DISC_R)}px`;
}
