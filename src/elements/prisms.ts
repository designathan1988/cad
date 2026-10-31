// Wall blocks, openings and floors as three.js prisms: for the 3D view (scene-3d.ts) and for the export
// (export-gltf.ts), so both are the same solids. World (x, y, height) maps to three.js (x, height, −y).

import * as THREE from 'three';
import type { Point2 } from '../model/vector';
import type { PrismFaces } from './wall/geometry/faces';
import { planeAt, type TopPlane } from './wall/geometry/under-roof';
import type { OpeningPart } from './opening/parts';

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

/**
 * A block whose top follows a plane (a wall under a roof: under-roof.ts), wound and grouped as
 * shownPrism: the sides that show (f; all without it) cut off under the plane, the top on it.
 */
export function slopedPrism(poly: readonly Point2[], bottom: number, plane: TopPlane, f: PrismFaces | undefined): THREE.BufferGeometry {
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => pos.push(v.x, v.y, v.z);
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const at = (t: number) => ({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
    const rects = f ? (f.sides[i] ?? []) : [{ t0: 0, t1: len, z0: bottom, z1: Infinity }];
    for (const r of rects) {
      const [p0, p1] = [at(r.t0), at(r.t1)];
      const h0 = Math.max(r.z0, Math.min(r.z1, planeAt(plane, p0)));
      const h1 = Math.max(r.z0, Math.min(r.z1, planeAt(plane, p1)));
      if (h0 - r.z0 < 1e-9 && h1 - r.z0 < 1e-9) continue;
      const a0 = toThree(p0, r.z0);
      const b0 = toThree(p1, r.z0);
      [a0, b0, toThree(p1, h1), a0, toThree(p1, h1), toThree(p0, h0)].forEach(push);
    }
  }
  const sides = pos.length / 3;
  for (let i = 1; i < n - 1; i++) [poly[0]!, poly[i]!, poly[i + 1]!].map((p) => toThree(p, planeAt(plane, p))).forEach(push);
  for (const c of f ? f.bottom : [poly]) for (let i = 1; i < c.length - 1; i++) [toThree(c[0]!, bottom), toThree(c[i + 1]!, bottom), toThree(c[i]!, bottom)].forEach(push);
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
  parts: readonly { readonly polygon: readonly Point2[]; readonly top: number; readonly topAt?: (p: Point2) => number }[],
  rails: readonly (readonly { x: number; y: number; z: number }[])[],
  riser: number,
  solid: boolean,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (const p of parts) {
    const low = solid ? 0 : Math.max(0, p.top - Math.min(0.05, riser));
    // A ramp's run slopes: its top at each corner.
    const top = (q: Point2) => (p.topAt ? p.topAt(q) : p.top);
    const poly = p.polygon;
    const n = poly.length;
    for (let i = 1; i < n - 1; i++) {
      tri(toThree(poly[0]!, low), toThree(poly[i + 1]!, low), toThree(poly[i]!, low));
      tri(toThree(poly[0]!, top(poly[0]!)), toThree(poly[i]!, top(poly[i]!)), toThree(poly[i + 1]!, top(poly[i + 1]!)));
    }
    for (let i = 0; i < n; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % n]!;
      tri(toThree(a, low), toThree(b, low), toThree(b, top(b)));
      tri(toThree(a, low), toThree(b, top(b)), toThree(a, top(a)));
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

/**
 * A guardrail: posts from its foot to its top, a top rail and a mid rail, each a square bar of `size`.
 * In three.js coordinates, its foot at height 0.
 */
export function railingGeometry(
  points: readonly Point2[],
  posts: readonly Point2[],
  height: number,
  size = 0.04,
  infill: 'rails' | 'balusters' | 'glass' = 'rails',
  spacing = 0.1,
  baluster = 0.02,
  rise?: readonly number[],
): { frame: THREE.BufferGeometry; glass: THREE.BufferGeometry | null } {
  const pos: number[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) =>
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  const h = size / 2;
  // A bar from (a, za) to (b, zb), square across.
  const bar = (a: Point2, za: number, b: Point2, zb: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = len > 1e-9 ? { x: (-(b.y - a.y) / len) * h, y: ((b.x - a.x) / len) * h } : { x: h, y: 0 };
    const corners = (p: Point2, z: number) => [v(p.x + n.x, p.y + n.y, z - h), v(p.x - n.x, p.y - n.y, z - h), v(p.x - n.x, p.y - n.y, z + h), v(p.x + n.x, p.y + n.y, z + h)];
    const A = corners(a, za);
    const B = corners(b, zb);
    for (let i = 0; i < 4; i++) quad(A[i]!, B[i]!, B[(i + 1) % 4]!, A[(i + 1) % 4]!);
  };
  // From its foot (z0) up `top`: on a stair's side the feet rise with the steps.
  const post = (p: Point2, s = h, top = height, z0 = 0) => {
    const c = [v(p.x - s, p.y - s, z0), v(p.x + s, p.y - s, z0), v(p.x + s, p.y + s, z0), v(p.x - s, p.y + s, z0)];
    const t = [v(p.x - s, p.y - s, z0 + top), v(p.x + s, p.y - s, z0 + top), v(p.x + s, p.y + s, z0 + top), v(p.x - s, p.y + s, z0 + top)];
    for (let i = 0; i < 4; i++) quad(c[i]!, c[(i + 1) % 4]!, t[(i + 1) % 4]!, t[i]!);
  };
  for (const p of posts) post(p, h, height, (p as Point2 & { z?: number }).z ?? 0);
  const glass: number[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const za = rise?.[i] ?? 0;
    const zb = rise?.[i + 1] ?? 0;
    bar(a, za + height, b, zb + height);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (infill === 'rails') bar(a, za + height / 2, b, zb + height / 2);
    else if (infill === 'balusters' && len > spacing) {
      // A bottom rail, and a baluster every `spacing` between it and the top rail.
      bar(a, za + 0.1, b, zb + 0.1);
      const n = Math.floor(len / spacing);
      for (let k = 1; k < n; k++) post({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }, baluster / 2, height, za + ((zb - za) * k) / n);
    } else if (infill === 'glass' && len > 2 * size) {
      // A pane between the posts, from a hand above the floor to under the top rail, on the rail's line.
      const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const p0 = { x: a.x + u.x * h, y: a.y + u.y * h };
      const p1 = { x: b.x - u.x * h, y: b.y - u.y * h };
      const t = 0.006;
      const nx = -u.y * t;
      const ny = u.x * t;
      // Its foot and top at each end, rising with the steps along a stair's side.
      const z0 = 0.05;
      const z1 = height - h;
      const g = (x: number, y: number, z: number) => [x, z, -y];
      const face = (sx: number, sy: number) =>
        glass.push(
          ...g(p0.x + sx, p0.y + sy, za + z0),
          ...g(p1.x + sx, p1.y + sy, zb + z0),
          ...g(p1.x + sx, p1.y + sy, zb + z1),
          ...g(p0.x + sx, p0.y + sy, za + z0),
          ...g(p1.x + sx, p1.y + sy, zb + z1),
          ...g(p0.x + sx, p0.y + sy, za + z1),
        );
      face(nx, ny);
      face(-nx, -ny);
    }
  }
  const frame = new THREE.BufferGeometry();
  frame.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  frame.computeVertexNormals();
  if (glass.length === 0) return { frame, glass: null };
  const panes = new THREE.BufferGeometry();
  panes.setAttribute('position', new THREE.Float32BufferAttribute(glass, 3));
  panes.computeVertexNormals();
  return { frame, glass: panes };
}

/** A door's or window's part as a prism, tilted about its level axis when it turns (a top-hung sash):
 * three.js's (x, height, −y) for the plan's (x, y, height). The 3D view and the openings' pictures share it. */
export function partPrism(part: OpeningPart): THREE.BufferGeometry {
  const geo = prism(part.polygon, part.bottom, part.top);
  if (part.turn) {
    const { origin, axis, angle } = part.turn;
    const o3 = new THREE.Vector3(origin.x, origin.z, -origin.y);
    const r = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis.x, 0, -axis.y).normalize(), angle);
    geo.applyMatrix4(new THREE.Matrix4().makeTranslation(-o3.x, -o3.y, -o3.z)).applyMatrix4(r).applyMatrix4(new THREE.Matrix4().makeTranslation(o3.x, o3.y, o3.z));
  }
  return geo;
}
