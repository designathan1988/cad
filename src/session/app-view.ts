// Where things are on screen and in the model: handles, the level below and its underlay, selection
//  kinds, the drawing settings, projections to the screen, the pointer's world point, heights and the box.

import type { App } from './app';
import { lengthNum } from '../i18n/units';
import * as viewing from './view-ui';
import * as files from '../project/files';
import * as THREE from 'three';
import { type Point2 } from '../model/vector';
import { drawingOf, levelOf } from '../project/doc';
import { kindOfId } from '../elements/registry';
import type { DrawingSettings } from '../elements/drawing/schema';
import { type SectionBox } from '../model/section-box';
import { exploding, liftOf } from './view/view-3d';
import { doorFlips, type Handles, handlesFor } from './handles';
import { hull } from '../model/hull';
import { currentDims } from '../ui/temp-dims';
import * as sceneCamera from '../render/scene-camera';
import { placedOf } from '../project/derived-queries';
import type { LevelId } from '../project/doc';

/**
 * The handles of the selected walls (handles.ts), in plan and in 3D on the level's floor: while selecting,
 * and while one of them is dragged (then on the walls as they are being dragged). None during a move or a window.
 */
export function handles(app: App): Handles {
  const d = app.ui.drag;
  if (app.ui.tool !== 'select' || d?.kind === 'move' || d?.kind === 'marquee' || d?.kind === 'dimLine') return handlesFor([], (p) => p);
  const walls = d && d.kind !== 'handle' ? d.walls : app.store.get().walls;
  // In 3D on the level's floor, where a drag takes its points (input.ts, worldAt): a wall selected there
  // had no end, arrow or turn to take, only its panel. Behind the camera, off the screen.
  const floor = app.ui.view === '3d' ? (levelOf(app.store.get(), app.ui.levelId)?.elevation ?? 0) + lift(app, app.ui.levelId) : 0;
  const toScreen = (p: Point2): Point2 => (app.ui.view === 'plan' ? app.plan.toScreen(p) : (projectAt(app, p, floor) ?? { x: -1e6, y: -1e6 }));
  const h = handlesFor(
    walls.filter((w) => app.ui.selection.has(w.id) && w.levelId === app.ui.levelId),
    toScreen,
    app.ui.view === 'plan' ? app.plan.dimValueBoxes(currentDims(app).map((x) => ({ ...x, text: lengthNum(x.value) }))) : [],
  );
  // One door selected, standing still: its flip controls, on the side its leaf sweeps (the side
  // `swing` names is the one its temporary dimension keeps off, opening-ui.ts).
  const one = app.ui.selection.size === 1 && !d ? [...app.ui.selection][0]! : null;
  const door = one ? placedOf(app.geometry, one) : undefined;
  if (!door || door.opening.kind !== 'door' || !door.frame) return h;
  return { ...h, flips: doorFlips(door.opening.id, door.frame, door.opening.swing === 'right' ? -1 : 1, toScreen) };
}

/** The level just below the one shown, if any: its plan is drawn faint under app one, and snapped to. */
export function levelBelow(app: App): LevelId | null {
  const levels = app.store.get().levels;
  const here = levels.find((l) => l.id === app.ui.levelId);
  return (here ? levels.filter((l) => l.elevation < here.elevation).sort((a, b) => b.elevation - a.elevation)[0]?.id : undefined) ?? null;
}

/** The wall pieces of the level below (none for the lowest, or with walls hidden). */
export function underlay(app: App): Point2[][] {
  const below = levelBelow(app);
  if (!below || app.ui.hidden.has('walls')) return [];
  return [...app.geometry.solids.values()].filter((s) => s.wall.levelId === below).flatMap((s) => s.pieces.map((p) => [...p.polygon]));
}

/** How many kinds of element (walls, doors and windows, rooms, floors, guides, notes) the selection holds. */
export function selectionKinds(app: App): number {
  const ids = [...app.ui.selection];
  return new Set(ids.flatMap((id) => kindOfId(id)?.key ?? [])).size;
}

/** The drawing settings the plan is drawn with now: the project's, at a saved view's own scale while it is shown. */
export function drawingNow(app: App): DrawingSettings {
  const d = drawingOf(app.store.get());
  return app.ui.viewDen === null ? d : { ...d, scale: app.ui.viewDen };
}

/** A world point on the current level, on the screen (viewport pixels); null when behind the camera. */
export function toScreen(app: App, p: Point2): Point2 | null {
  if (app.ui.view === 'plan') return app.plan.toScreen(p);
  return projectAt(app, p, (app.store.get().levels.find((l) => l.id === app.ui.levelId)?.elevation ?? 0) + lift(app, app.ui.levelId));
}

/** A world point at a height, on the screen of the 3D view (viewport pixels); null when behind the camera. */
export function projectAt(app: App, p: Point2, z: number): Point2 | null {
  const v = new THREE.Vector3(p.x, z, -p.y).project(app.scene.camera);
  if (v.z > 1) return null;
  const r = app.shell.viewport.getBoundingClientRect();
  return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
}

/** A piece's outline on the screen: the polygon in plan, the hull of its prism in 3D (lifted with its level). */
export function outlineOnScreen(app: App, poly: readonly Point2[], bottom: number, top: number, lift = 0): Point2[] {
  if (app.ui.view === 'plan') return poly.map((p) => app.plan.toScreen(p));
  const r = app.shell.viewport.getBoundingClientRect();
  const pts: Point2[] = [];
  for (const p of poly) {
    for (const z of [bottom + lift, top + lift]) {
      const v = new THREE.Vector3(p.x, z, -p.y).project(app.scene.camera);
      if (v.z <= 1) pts.push({ x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height });
    }
  }
  return hull(pts);
}

/** The world point under the pointer, on the level shown, for the view as it is now. */
export function pointerWorld(app: App): Point2 | null {
  if (!app.pointer) return null;
  if (app.ui.view === 'plan') {
    const r = app.shell.planCanvas.getBoundingClientRect();
    return app.plan.toWorld({ x: app.pointer.x - r.left, y: app.pointer.y - r.top });
  }
  const z = (levelOf(app.store.get(), app.ui.levelId)?.elevation ?? 0) + lift(app, app.ui.levelId);
  return sceneCamera.groundPoint(app.scene, app.pointer.x, app.pointer.y, z);
}

/** How far up a level is drawn in 3D: exploded, each level above the one below; else not at all. */
export function lift(app: App, levelId: LevelId | undefined): number {
  const levels = app.store.get().levels;
  return app.ui.view === '3d' && levelId !== undefined ? liftOf(levels, levelId, exploding(levels, app.ui.levelId, app.ui.view3d)) : 0;
}

export function height(app: App): number {
  return Math.max(2.8, ...[...app.geometry.solids.values()].map((s) => s.top + lift(app, s.wall.levelId)));
}

/** The box as dragged: drawn now, kept with the view when `keep` (the drag's end). */
export function setBox(app: App, box: SectionBox, keep: boolean): void {
  return viewing.setBox(app, box, keep);
}

/** Opens a project file in place of the current project, as one undo step. */
export async function openFile(app: App, file: File): Promise<void> {
  return files.openFile(app, file);
}
