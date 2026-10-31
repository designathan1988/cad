// Cutting the 3D view: the plan cut, the section box, a section line and the orthographic camera.

import type { Scene3D } from './scene-3d';
import * as THREE from 'three';
import type { Point2 } from '../model/vector';
import { type SectionLine, sectionLooks } from '../model/section-box';
import { clipPlanes, syncBoxCaps } from './scene-build';

/**
 * Cuts everything above height z away (null: no cut), and fills where it goes through the walls with
 * `sections`, the walls' pieces at that height (the plan's, which already leave the doors and windows out).
 */
export function setCut(view: Scene3D, z: number | null, sections: readonly (readonly Point2[])[]): void {
  const key = z === null ? '' : JSON.stringify([z, sections]);
  if (key === view.capsKey) return;
  view.capsKey = key;
  view.cutPlane = z === null ? null : new THREE.Plane(new THREE.Vector3(0, -1, 0), z);
  clipPlanes(view);
  for (const c of [...view.caps.children]) {
    view.caps.remove(c);
    if (c instanceof THREE.Mesh) c.geometry.dispose();
  }
  if (z !== null) {
    for (const poly of sections) {
      if (poly.length < 3) continue;
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, p.y)))), view.capMaterial);
      // The shape lies in x–y; turned −90° about x it lies in three.js x–(−z), as the floors do.
      mesh.rotation.x = -Math.PI / 2;
      // Just under the plane, which would otherwise clip it half the time.
      mesh.position.y = z - 0.0005;
      view.caps.add(mesh);
    }
  }
  view.invalidate();
}

/**
 * The section box (section-box.ts): everything outside it clipped away, by six planes facing in.
 * Plan x, y and height z are three.js x, −z and y.
 */
export function setBox(view: Scene3D, box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null): void {
  const key = JSON.stringify(box);
  if (key === view.boxKey) return;
  view.boxKey = key;
  view.boxBox = box;
  view.boxPlanes = box
    ? [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -box.min.x),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), box.max.x),
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -box.min.z),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), box.max.z),
        // Plan y ≥ min: three.js z ≤ −min.
        new THREE.Plane(new THREE.Vector3(0, 0, -1), -box.min.y),
        new THREE.Plane(new THREE.Vector3(0, 0, 1), box.max.y),
      ]
    : [];
  clipPlanes(view);
  syncBoxCaps(view);
  view.invalidate();
}

/** A vertical section (section-box.ts): what lies behind its line clipped away, its cut filled. */
export function setSection(view: Scene3D, s: SectionLine | null): void {
  if (JSON.stringify(s) === JSON.stringify(view.sectionLine)) return;
  view.sectionLine = s;
  if (s) {
    const n = sectionLooks(s);
    // Kept: n · (p − point) ≥ 0, with plan (x, y) at three.js (x, −z).
    view.sectionPlane = new THREE.Plane(new THREE.Vector3(n.x, 0, -n.y), -(n.x * s.point.x + n.y * s.point.y));
  } else view.sectionPlane = null;
  clipPlanes(view);
  syncBoxCaps(view);
  view.invalidate();
}

/**
 * Orthographic or perspective, the view kept as seen: the same direction and target, and the model
 * the same size in the middle of the view.
 */
export function setOrtho(view: Scene3D, on: boolean): void {
  if (on === view.orthoOn) return;
  const from = view.camera;
  const to = on ? view.ortho : view.persp;
  const target = view.controls.target;
  const dist = from.position.distanceTo(target);
  const tan = Math.tan((view.persp.fov * Math.PI) / 360);
  if (on) {
    view.orthoHalf = dist * tan;
    view.ortho.zoom = 1;
    to.position.copy(from.position);
  } else {
    // Back at the distance where the perspective shows what the parallel view showed.
    const d = view.orthoHalf / view.ortho.zoom / tan;
    to.position.copy(target).add(from.position.clone().sub(target).setLength(d));
  }
  to.quaternion.copy(from.quaternion);
  to.up.copy(from.up);
  view.orthoOn = on;
  view.controls.object = to;
  view.controls.update();
  view.offsetDirty = true;
  view.invalidate();
}
