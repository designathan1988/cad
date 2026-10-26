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

/**
 * A floor slab with its holes, extruded from its bottom by its thickness, and tilted by its slope: in
 * the shape's own x–y (plan) with the height along z, before the caller turns it −90° about x.
 */
export function slabGeometry(outline: readonly Point2[], holes: readonly (readonly Point2[])[], thickness: number, rise?: (p: Point2) => number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, p.y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  if (rise) {
    // Every point up by the slope at its place in plan: the slab keeps its thickness, upright.
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + rise({ x: pos.getX(i), y: pos.getY(i) }));
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

/**
 * A stair: each step and landing a solid from the stair's bottom up to its top (a spiral's, a slab of
 * its riser), and its handrails as narrow upright ribbons. In three.js coordinates, from height 0.
 */
export function stairGeometry(
  parts: readonly { readonly polygon: readonly Point2[]; readonly top: number }[],
  rails: readonly (readonly { x: number; y: number; z: number }[])[],
  riser: number,
  solid: boolean,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (const p of parts) {
    const low = solid ? 0 : Math.max(0, p.top - Math.min(0.05, riser));
    const poly = p.polygon;
    const n = poly.length;
    for (let i = 1; i < n - 1; i++) {
      tri(toThree(poly[0]!, low), toThree(poly[i + 1]!, low), toThree(poly[i]!, low));
      tri(toThree(poly[0]!, p.top), toThree(poly[i]!, p.top), toThree(poly[i + 1]!, p.top));
    }
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      tri(toThree(a, low), toThree(b, low), toThree(b, p.top));
      tri(toThree(a, low), toThree(b, p.top), toThree(a, p.top));
    }
  }
  for (const r of rails) {
    for (let i = 0; i + 1 < r.length; i++) {
      const a = r[i]!;
      const b = r[i + 1]!;
      // A 5 cm ribbon under the rail's line, and a post down to the steps at its start.
      tri(new THREE.Vector3(a.x, a.z, -a.y), new THREE.Vector3(b.x, b.z, -b.y), new THREE.Vector3(b.x, b.z - 0.05, -b.y));
      tri(new THREE.Vector3(a.x, a.z, -a.y), new THREE.Vector3(b.x, b.z - 0.05, -b.y), new THREE.Vector3(a.x, a.z - 0.05, -a.y));
    }
    for (const v of [r[0]!, r[r.length - 1]!]) {
      const q = 0.02;
      tri(new THREE.Vector3(v.x - q, v.z, -v.y), new THREE.Vector3(v.x + q, v.z, -v.y), new THREE.Vector3(v.x + q, v.z - 0.9, -v.y));
      tri(new THREE.Vector3(v.x - q, v.z, -v.y), new THREE.Vector3(v.x + q, v.z - 0.9, -v.y), new THREE.Vector3(v.x - q, v.z - 0.9, -v.y));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * A roof's faces as solid slabs (their build-up `thickness` square to each face's slope, so taller
 * upright), its gable infills and a flat roof's parapet: one geometry, in three.js coordinates.
 */
export function roofGeometry(
  faces: readonly { readonly polygon: readonly Point2[]; readonly z: (p: Point2) => number; readonly grade: number }[],
  gables: readonly (readonly { x: number; y: number; z: number }[])[],
  parapets: readonly { readonly polygon: readonly Point2[]; readonly bottom: number; readonly top: number }[],
  thickness: number,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const slab = (poly: readonly Point2[], low: (p: Point2) => number, high: (p: Point2) => number) => {
    const n = poly.length;
    for (let i = 1; i < n - 1; i++) {
      tri(toThree(poly[0]!, low(poly[0]!)), toThree(poly[i + 1]!, low(poly[i + 1]!)), toThree(poly[i]!, low(poly[i]!)));
      tri(toThree(poly[0]!, high(poly[0]!)), toThree(poly[i]!, high(poly[i]!)), toThree(poly[i + 1]!, high(poly[i + 1]!)));
    }
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      tri(toThree(a, low(a)), toThree(b, low(b)), toThree(b, high(b)));
      tri(toThree(a, low(a)), toThree(b, high(b)), toThree(a, high(a)));
    }
  };
  for (const f of faces) {
    const up = thickness * Math.sqrt(1 + f.grade * f.grade);
    slab(f.polygon, f.z, (p) => f.z(p) + up);
  }
  for (const g of gables) {
    const pts = g.map((v) => new THREE.Vector3(v.x, v.z, -v.y));
    for (let i = 1; i < pts.length - 1; i++) tri(pts[0]!, pts[i]!, pts[i + 1]!);
  }
  for (const p of parapets) slab(p.polygon, () => p.bottom, () => p.top);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
