// Wall blocks, openings and floors as three.js prisms: for the 3D view (scene-3d.ts) and for the export
// (export-gltf.ts), so both are the same solids. World (x, y, height) maps to three.js (x, height, −y).

import * as THREE from 'three';
import type { Point2 } from '../core/vector';
import type { PrismFaces } from '../elements/wall/geometry/faces';

export const toThree = (p: Point2, z: number) => new THREE.Vector3(p.x, z, -p.y);

/** A prism of only the faces that show (faces.ts), wound as prism(): sides in group 0, caps in group 1. */
export function shownPrism(poly: readonly Point2[], bottom: number, top: number, f: PrismFaces): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const at = (t: number) => ({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
    for (const r of f.sides[i] ?? []) {
      const a0 = toThree(at(r.t0), r.z0);
      const b0 = toThree(at(r.t1), r.z0);
      const a1 = toThree(at(r.t0), r.z1);
      const b1 = toThree(at(r.t1), r.z1);
      [a0, b0, b1, a0, b1, a1].forEach(push);
    }
  }
  const sides = pos.length / 3;
  for (const c of f.top) for (let i = 1; i < c.length - 1; i++) [toThree(c[0]!, top), toThree(c[i]!, top), toThree(c[i + 1]!, top)].forEach(push);
  for (const c of f.bottom) for (let i = 1; i < c.length - 1; i++) [toThree(c[0]!, bottom), toThree(c[i + 1]!, bottom), toThree(c[i]!, bottom)].forEach(push);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.addGroup(0, sides, 0);
  g.addGroup(sides, pos.length / 3 - sides, 1);
  g.computeVertexNormals();
  return g;
}

export /** A vertical prism over a convex CCW polygon: sides in group 0, top and bottom in group 1. */
function prism(poly: readonly Point2[], bottom: number, top: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const a0 = toThree(a, bottom);
    const b0 = toThree(b, bottom);
    const a1 = toThree(a, top);
    const b1 = toThree(b, top);
    [a0, b0, b1, a0, b1, a1].forEach(push);
  }
  const sides = pos.length / 3;
  for (let i = 1; i < n - 1; i++) {
    [toThree(poly[0]!, top), toThree(poly[i]!, top), toThree(poly[i + 1]!, top)].forEach(push);
    [toThree(poly[0]!, bottom), toThree(poly[i + 1]!, bottom), toThree(poly[i]!, bottom)].forEach(push);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.addGroup(0, sides, 0);
  g.addGroup(sides, pos.length / 3 - sides, 1);
  g.computeVertexNormals();
  return g;
}
