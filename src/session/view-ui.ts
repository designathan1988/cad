// The views: plan or 3D, framing, the view keys, elevations and sections, the section box, exploding the levels. Functions over the app (app.ts delegates).

import * as THREE from 'three';
import { type Point2 } from '../model/vector';
import { type Insets } from '../render/plan-types';
import { t } from '../i18n/messages';
import { type ViewId } from '../ui/shell';
import { hasSolid } from '../elements/registry';
import { levelOf } from '../project/doc';
import { boundsOf } from '../project/derived-queries';
import { savePrefs } from '../project/persist';
import { fitFactor, keepInView } from './keep-in-view';
import type { ViewKey } from './view-keys';
import { BOX_FACES, type BoxFace, boxAround, faceCenter, faceNormal, type SectionBox, sectionLooks } from '../model/section-box';
import { BOX_HANDLE_HIT } from '../render/overlay-3d';
import { shownLevels, type View3D } from './view/view-3d';
import { ROTATE_OFFSET } from './handles';
import type { App } from './app';
import { currentDims } from '../ui/temp-dims';
import * as sceneCamera from '../render/scene-camera';
import * as sceneCut from '../render/scene-cut';
import * as appView from './app-view';

/** The section box on, around what the 3D shows, or off. */
export function toggleBox(app: App): void {
  if (app.ui.view3d.box) return setView3D(app, { box: null });
  const doc = app.store.get();
  const bottom = Math.min(...doc.levels.map((l) => l.elevation));
  const top = Math.max(...doc.levels.map((l) => l.elevation + l.height));
  setView(app, '3d');
  setView3D(app, { box: boxAround(boundsOf(app.visibleGeometry()), bottom, top) });
}

/** The box face whose handle is at a screen point (client coordinates), nearest first; null when none. */
export function boxHandleAt(app: App, clientX: number, clientY: number): BoxFace | null {
  const box = app.ui.view3d.box;
  if (!box || app.ui.view !== '3d') return null;
  const r = app.shell.viewport.getBoundingClientRect();
  let best: BoxFace | null = null;
  let bestD = BOX_HANDLE_HIT;
  for (const f of BOX_FACES) {
    const c = faceCenter(box, f);
    const p = appView.projectAt(app, c, c.z);
    if (!p) continue;
    const d = Math.hypot(p.x + r.left - clientX, p.y + r.top - clientY);
    if (d <= bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** Pixels a face's handle moves on screen for 1 m out (its drag direction). */
export function boxFaceOnScreen(app: App, face: BoxFace): Point2 {
  const box = app.ui.view3d.box;
  if (!box) return { x: 0, y: 0 };
  const c = faceCenter(box, face);
  const n = faceNormal(face);
  const a = appView.projectAt(app, c, c.z);
  const b = appView.projectAt(app, { x: c.x + n.x, y: c.y + n.y }, c.z + n.z);
  return a && b ? { x: b.x - a.x, y: b.y - a.y } : { x: 0, y: 0 };
}

/** The box as dragged: drawn now, kept with the view when `keep` (the drag's end). */
export function setBox(app: App, box: SectionBox, keep: boolean): void {
  app.ui.view3d = { ...app.ui.view3d, box };
  if (keep) savePrefs({ view3d: app.ui.view3d });
  app.render();
}

/** Explode on or off; with one level shown, said why it does nothing instead. */
export function toggleExplode(app: App): void {
  const doc = app.store.get();
  if (shownLevels(doc.levels, app.ui.levelId, app.ui.view3d.levels).size < 2) {
    if (app.ui.view !== '3d') setView(app, '3d');
    app.ui.info = t(doc.levels.length < 2 ? 'hint.explodeOneLevel' : 'hint.explodeOneShown');
    return app.renderChrome();
  }
  setView3D(app, { explode: !app.ui.view3d.explode });
}

/** How the 3D view shows the levels; kept with the preferences, as the view is. */
export function setView3D(app: App, patch: Partial<View3D>): void {
  // From the plan (the palette), the 3D view it is about is shown.
  if (app.ui.view !== '3d') setView(app, '3d');
  app.ui.view3d = { ...app.ui.view3d, ...patch };
  // A word on the view as it was (Explode with one level shown) no longer holds.
  app.ui.info = null;
  savePrefs({ view3d: app.ui.view3d });
  // Levels hidden now leave the selection, as a hidden category does.
  const shown = app.visibleGeometry();
  for (const id of [...app.ui.selection]) {
    if (!hasSolid(shown.kinds, id)) app.ui.selection.delete(id);
  }
  app.refresh();
}

export function setView(app: App, view: ViewId): void {
  if (app.ui.view === view) return;
  app.ui.view = view;
  // Guides are the plan's: one being placed is dropped.
  app.ui.guide = null;
  savePrefs({ view });
  app.render();
  if (!app.framed[view]) frameFirst(app);
}

/** A view's first show: the plan where it was left before a reload, else everything framed. */
export function frameFirst(app: App): void {
  const saved = app.ui.view === 'plan' ? app.savedPlanView : null;
  app.savedPlanView = null;
  if (!saved) return app.frameAll();
  app.framed.plan = true;
  app.plan.scale = saved.scale;
  app.plan.center = saved.center;
  app.render();
}

/** The plan's zoom and position, kept for the next visit once they have been still for a moment. */
export function keepPlanView(app: App): void {
  if (app.ui.view !== 'plan' || !app.framed.plan) return;
  const { scale, center } = app.plan;
  const key = `${scale}|${center.x}|${center.y}`;
  if (key === app.planViewKept) return;
  app.planViewKept = key;
  clearTimeout(app.planViewTimer);
  app.planViewTimer = window.setTimeout(() => savePrefs({ planView: { scale, center: { x: center.x, y: center.y } } }), 400);
}

/**
 * When the selection changes and the panel lying over the drawing would hide it (the sheet on a
 * phone, the drawer on a tablet), the plan slides just enough to show it beside the panel.
 */
export function keepSelectionInView(app: App): boolean {
  const cover = covered(app);
  const vp0 = app.shell.viewport.getBoundingClientRect();
  // Again when the selection changes, or the panel or a drawer (or the window) changes what is free.
  // The selection's own extent counts too: an arc given a larger radius can reach under the panel.
  const ids = JSON.stringify([...app.ui.selection]);
  const extent = boundsOf(app.geometry, app.ui.selection);
  const shape = JSON.stringify(extent && [extent.min, extent.max].map((p) => [Math.round(p.x * 100), Math.round(p.y * 100)]));
  const key = JSON.stringify([ids, shape, cover, Math.round(vp0.width), Math.round(vp0.height)]);
  if (key === app.seenSelection) return false;
  app.seenSelection = key;
  // A new selection moves the plan only from under what covers it: clicking a long wall that runs
  // past the edge does not pan. A window that changed size, or a selected element that changed
  // extent (an arc given a larger radius), moves it back from the drawing's own edges too.
  const size = `${Math.round(vp0.width)}x${Math.round(vp0.height)}`;
  const resized = app.seenSize !== '' && size !== app.seenSize;
  const reshaped = ids === app.seenIds && shape !== app.seenShape;
  app.seenSize = size;
  app.seenIds = ids;
  app.seenShape = shape;
  if (app.ui.selection.size === 0) return false;
  // Never under the pointer's hand: a drag that brought the panel in slid the drawing mid-gesture.
  if (app.ui.drag) return false;
  if (!resized && !reshaped && cover.right === 0 && cover.bottom === 0 && !cover.left) return false;
  const box = boundsOf(app.geometry, app.ui.selection);
  if (!box) return false;
  // On screen: the selection, its turn handle (handles.ts) and its temporary dimensions with their
  // values, which stand off the element by its clearance. The window's own edges count as well as
  // what covers it: a smaller window leaves a selection near its edge out otherwise.
  const onScreen = () => {
    const a = app.plan.toScreen({ x: box.min.x, y: box.max.y });
    const b = app.plan.toScreen({ x: box.max.x, y: box.min.y });
    const xs = [a.x, b.x];
    // The turn handle: under the selection, lower still where it keeps clear of an end's arrow.
    const turn = appView.handles(app).rotate?.at.y;
    const ys = [a.y, Math.max(b.y + ROTATE_OFFSET, turn ?? 0) + 12];
    const TEXT = 12;
    // The dimensions count under a phone's sheet (the tester's P07); beside a drawer only the element
    // itself: its dimensions reaching under the drawer moved the drawing for something already seen.
    if (cover.bottom > 0) for (const d of currentDims(app)) {
      const line = app.plan.dimLine(d);
      for (const p of [line.a, line.b]) xs.push(p.x - TEXT, p.x + TEXT), ys.push(p.y - TEXT, p.y + TEXT);
    }
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  };
  const view = { w: vp0.width, h: vp0.height };
  const room = { margin: 16, above: 48 };
  // Larger than the free part (a phone's): zoomed out about its middle first, then measured again,
  // since the dimensions stand off by pixels (the tester's P07: the view only panned and cut it).
  let screen = onScreen();
  // Larger than the whole window at this zoom (the terrain, a long wall seen up close): the user is
  // looking at part of it on purpose. A new selection of it moves nothing: at 880 px a click on the
  // terrain zoomed the plan out to the whole lot.
  if (!resized && !reshaped && (screen.right - screen.left > view.w || screen.bottom - screen.top > view.h)) return false;
  const k = fitFactor(screen, view, cover, room);
  if (k < 1) {
    app.plan.zoomAt({ x: (screen.left + screen.right) / 2, y: (screen.top + screen.bottom) / 2 }, k);
    screen = onScreen();
  }
  const { dx, dy } = keepInView(screen, view, cover, room);
  if (dx === 0 && dy === 0 && k === 1) return false;
  app.plan.panBy(dx, dy);
  return true;
}

/**
 * The 3D view's counterpart: when the selection changes and a panel lying over the drawing (the
 * drawer, a phone's sheet) covers the selected element, the view slides just enough to show it; the
 * camera stays. Never while dragging, and not when nothing covers it.
 */
export function keepSelectionInView3d(app: App): boolean {
  const cover = covered(app);
  const ids = JSON.stringify([...app.ui.selection]);
  const key = JSON.stringify([ids, cover]);
  if (key === app.seenSelection3d) return false;
  app.seenSelection3d = key;
  if (app.ui.selection.size === 0 || app.ui.drag) return false;
  if (cover.right === 0 && cover.bottom === 0 && !cover.left) return false;
  const box = boundsOf(app.geometry, app.ui.selection);
  if (!box) return false;
  const level = levelOf(app.store.get(), app.ui.levelId);
  const z0 = (level?.elevation ?? 0) + appView.lift(app, app.ui.levelId);
  const z1 = z0 + (level?.height ?? 2.8);
  const pts = [box.min, box.max, { x: box.min.x, y: box.max.y }, { x: box.max.x, y: box.min.y }].flatMap((p) => [appView.projectAt(app, p, z0), appView.projectAt(app, p, z1)]).filter((p): p is Point2 => p !== null);
  if (pts.length === 0) return false;
  const vp = app.shell.viewport.getBoundingClientRect();
  const screen = { left: Math.min(...pts.map((p) => p.x)), right: Math.max(...pts.map((p) => p.x)), top: Math.min(...pts.map((p) => p.y)), bottom: Math.max(...pts.map((p) => p.y)) };
  const { dx, dy } = keepInView(screen, { w: vp.width, h: vp.height }, cover, { margin: 16, above: 48 });
  if (dx === 0 && dy === 0) return false;
  sceneCamera.panScreen(app.scene, dx, dy);
  return true;
}

/** How much the panel covers of the viewport, at its right (drawer) or bottom (phone sheet). */
/** The part of the viewport the panels cover, given to the 3D view so its centre stays in the rest (each frame). */
export function applyCovered(app: App): Insets {
  const c = covered(app);
  sceneCamera.setCovered(app.scene, c);
  return c;
}

export function covered(app: App): Insets {
  const vp = app.shell.viewport.getBoundingClientRect();
  const b = app.shell.browser.hidden ? null : app.shell.browser.getBoundingClientRect();
  const left = b && b.width > 0 ? b.right - vp.left : 0;
  if (app.shell.panel.hidden) return { right: 0, bottom: 0, left };
  const p = app.shell.panel.getBoundingClientRect();
  if (p.width === 0 || p.height === 0) return { right: 0, bottom: 0, left };
  if (p.top > vp.top + 8 && p.top < vp.bottom) return { right: 0, bottom: vp.bottom - p.top, left };
  if (p.left > vp.left && p.left < vp.right) return { right: vp.right - p.left, bottom: 0, left };
  return { right: 0, bottom: 0, left };
}

export function frameAll(app: App): void {
  const r = app.shell.viewport.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  app.framed[app.ui.view] = true;
  const box = boundsOf(app.visibleGeometry());
  sceneCamera.setCovered(app.scene, covered(app));
  if (app.ui.view === 'plan') app.plan.frame(box, covered(app));
  else sceneCamera.frame(app.scene, box, appView.height(app));
  app.render();
}

/**
 * An elevation (Revit's North, South, East and West): the model seen square from that side, parallel.
 * North is up the plan (+y).
 */
export function elevation(app: App, side: 'north' | 'south' | 'east' | 'west'): void {
  setView(app, '3d');
  setView3D(app, { ortho: true });
  sceneCut.setOrtho(app.scene, true);
  const dir = { north: new THREE.Vector3(0, 0, -1), south: new THREE.Vector3(0, 0, 1), east: new THREE.Vector3(1, 0, 0), west: new THREE.Vector3(-1, 0, 0) }[side];
  sceneCamera.setCovered(app.scene, covered(app));
  app.framed['3d'] = true;
  sceneCamera.frame(app.scene, boundsOf(app.visibleGeometry()), appView.height(app), dir);
  app.render();
}

/**
 * A vertical section through the selected guide (Revit's Section): the 3D keeps what lies on one side
 * of it, its cut filled, seen square and parallel from the other. `flip`: the other side.
 */
export function sectionAtGuide(app: App, flip = false): void {
  const doc = app.store.get();
  const g = doc.guides.find((x) => app.ui.selection.has(x.id) && !x.shape);
  if (!g) {
    app.ui.info = t('hint.sectionNoGuide');
    return app.renderChrome();
  }
  // Kept by default: the side with more of the model (the walls' ends on each side), as one would
  // look at it; `flip` the other one.
  const left = { x: -g.dir.y, y: g.dir.x };
  const side = doc.walls.reduce((s, w) => s + Math.sign((w.start.x + w.end.x) / 2 * left.x + ((w.start.y + w.end.y) / 2) * left.y - (g.point.x * left.x + g.point.y * left.y)), 0);
  const along = side >= 0 !== flip ? g.dir : { x: -g.dir.x, y: -g.dir.y };
  const section = { point: g.point, dir: along };
  setView(app, '3d');
  setView3D(app, { section, ortho: true });
  sceneCut.setOrtho(app.scene, true);
  sceneCut.setSection(app.scene, section);
  const n = sectionLooks(section);
  sceneCamera.setCovered(app.scene, covered(app));
  app.framed['3d'] = true;
  // From the cut side, looking across the line at what it keeps.
  sceneCamera.frame(app.scene, boundsOf(app.visibleGeometry()), appView.height(app), new THREE.Vector3(-n.x, 0, n.y));
  app.toast(t('toast.section'));
  app.render();
}

/** The vertical section off: the whole model again. */
export function clearSection(app: App): void {
  if (app.ui.view3d.section) setView3D(app, { section: null });
}

export function frameSelection(app: App): void {
  const box = boundsOf(app.geometry, app.ui.selection);
  // Nothing selected, or nothing with an extent (a guide has no ends): the whole drawing.
  if (box === null) return app.frameAll();
  sceneCamera.setCovered(app.scene, covered(app));
  if (app.ui.view === 'plan') app.plan.frame(box, covered(app));
  else sceneCamera.frame(app.scene, box, appView.height(app));
  app.render();
}

/**
 * The view by keyboard (view-keys.ts): in plan, zoom about the middle of the free part and move by
 * pixels; in 3D, zoom toward the target and turn about it (80 px a press is about 10°).
 */
export function keyView(app: App, action: ViewKey): void {
  if (app.ui.view === 'plan') {
    const vp = app.shell.viewport.getBoundingClientRect();
    const c = covered(app);
    const middle = { x: ((c.left ?? 0) + vp.width - c.right) / 2, y: (vp.height - c.bottom) / 2 };
    if ('zoom' in action) app.plan.zoomAt(middle, action.zoom);
    else app.plan.panBy(action.pan.x, action.pan.y);
    return app.render();
  }
  if ('zoom' in action) sceneCamera.zoomBy(app.scene, action.zoom);
  else sceneCamera.orbit(app.scene, (action.pan.x / 80) * (Math.PI / 18), (action.pan.y / 80) * (Math.PI / 18));
  app.render();
}
