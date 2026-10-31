// The 3D view's camera as the pointer moves it: what is under a point, the ground under it, metres per
//  pixel, panning, orbiting, zooming, framing a box, and the part of the view the panels cover.

import type { Scene3D } from './scene-3d';
import * as THREE from 'three';
import type { Point2 } from '../model/vector';
import type { WallId } from '../elements/wall/schema';
import { toThree } from '../elements/prisms';

/** The wall under a screen point, by ray cast. */
export function pick(view: Scene3D, clientX: number, clientY: number): WallId | null {
  const r = view.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, view.camera);
  const hit = ray.intersectObjects([...view.walls.values()].map((w) => w.group), true)[0];
  let o: THREE.Object3D | null = hit?.object ?? null;
  while (o && o.userData.wallId === undefined) o = o.parent;
  return (o?.userData.wallId as WallId | undefined) ?? null;
}

/** Where a screen point meets the horizontal plane at height z, in world plan coordinates. */
export function groundPoint(view: Scene3D, clientX: number, clientY: number, z: number): Point2 | null {
  const r = view.canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, view.camera);
  const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -z), new THREE.Vector3());
  return hit ? { x: hit.x, y: -hit.z } : null;
}

/** Metres per screen pixel at a world point, for snapping. */
export function metresPerPixel(view: Scene3D, p: Point2, z: number): number {
  const h = view.canvas.clientHeight || 1;
  if (view.orthoOn) return (2 * view.orthoHalf) / view.ortho.zoom / h;
  const d = view.persp.position.distanceTo(toThree(p, z));
  return (2 * d * Math.tan((view.persp.fov * Math.PI) / 360)) / h;
}

/** How much a panel covers at the right and bottom edges of the canvas (screen pixels). */
/** The view moved on screen by (dx, dy) px, the camera left where it is: a selection brought out from under a panel. */
export function panScreen(view: Scene3D, dx: number, dy: number): void {
  view.shift = { x: view.shift.x - dx, y: view.shift.y - dy };
  view.offsetDirty = true;
  view.invalidate();
}

export function setCovered(view: Scene3D, covered: { right: number; bottom: number; left?: number }): void {
  const next = { right: covered.right, bottom: covered.bottom, left: covered.left ?? 0 };
  if (next.right === view.covered.right && next.bottom === view.covered.bottom && next.left === view.covered.left) return;
  view.covered = next;
  view.offsetDirty = true;
  view.invalidate();
}

export function frame(view: Scene3D, box: { min: Point2; max: Point2 } | null, height: number, dir = new THREE.Vector3(0.55, 0.62, 0.75)): void {
  const b = box ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } };
  const center = toThree({ x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 }, height / 2);
  const radius = Math.max(1, Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, height) / 2);
  // Fit in the visible part: its aspect, and the share of the height it keeps.
  const w = view.canvas.clientWidth || 1;
  const h = view.canvas.clientHeight || 1;
  const visW = Math.max(w - view.covered.right - view.covered.left, w * 0.3);
  const visH = Math.max(h - view.covered.bottom, h * 0.3);
  view.controls.target.copy(center);
  // Centred in what the panels leave visible now.
  view.shift = { x: (view.covered.right - view.covered.left) / 2, y: view.covered.bottom / 2 };
  view.offsetDirty = true;
  if (view.orthoOn) {
    // As tall as the model needs, from far enough that nothing is behind the camera.
    view.orthoHalf = ((radius * 1.05) / Math.min(1, visW / visH)) * (h / visH);
    view.ortho.zoom = 1;
    view.offsetDirty = true;
    view.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(radius * 4 + 20));
  } else {
    const fit = (radius / Math.sin((view.persp.fov * Math.PI) / 360) / Math.min(1, visW / visH)) * (h / visH);
    view.camera.position.copy(center).add(dir.clone().normalize().multiplyScalar(fit * 1.05));
  }
  view.camera.up.set(0, 1, 0);
  view.controls.update();
  view.invalidate();
}

/**
 * The camera by keyboard: turned about its target (radians across and up), and moved toward it or
 * away (`zoom` > 1 nearer), within the limits the mouse has.
 */
export function orbit(view: Scene3D, across: number, up: number): void {
  const offset = view.camera.position.clone().sub(view.controls.target);
  const s = new THREE.Spherical().setFromVector3(offset);
  s.theta -= across;
  s.phi = Math.min(Math.max(s.phi - up, 0.05), view.controls.maxPolarAngle);
  view.camera.position.copy(view.controls.target).add(offset.setFromSpherical(s));
  view.camera.lookAt(view.controls.target);
  view.controls.update();
  view.invalidate();
}

export function zoomBy(view: Scene3D, zoom: number): void {
  if (view.orthoOn) {
    view.ortho.zoom = Math.min(Math.max(view.ortho.zoom * zoom, 0.02), 200);
    view.ortho.updateProjectionMatrix();
    view.controls.update();
    return view.invalidate();
  }
  const offset = view.camera.position.clone().sub(view.controls.target);
  const d = Math.min(Math.max(offset.length() / zoom, view.controls.minDistance), view.controls.maxDistance);
  view.camera.position.copy(view.controls.target).add(offset.setLength(d));
  view.controls.update();
  view.invalidate();
}
