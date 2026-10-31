// The shape of an evaluated object's pieces: their corners, rims and points, their outline in plan and
// their height span.

import type { Piece } from './evaluate';

/** A piece's outline in plan: a box's four corners, a cylinder's circle as a polygon. */
/** A leaning box's eight corners in the world (z above the level's floor). */
export function boxCorners(p: Extract<Piece, { kind: 'box' }>): { x: number; y: number; z: number }[] {
  const t = p.tilt ?? 0;
  const r = p.roll ?? 0;
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  const out: { x: number; y: number; z: number }[] = [];
  for (const x of [-p.w / 2, p.w / 2])
    for (const y of [-p.d / 2, p.d / 2])
      for (const z of [0, p.h]) {
        // Tilt about its x axis, roll about its y axis, through its base's centre; then its turn in plan.
        const y1 = y * Math.cos(t) + z * Math.sin(t);
        const z1 = -y * Math.sin(t) + z * Math.cos(t);
        const x2 = x * Math.cos(r) + z1 * Math.sin(r);
        const z2 = -x * Math.sin(r) + z1 * Math.cos(r);
        out.push({ x: p.cx + x2 * c - y1 * s, y: p.cy + x2 * s + y1 * c, z: p.z + z2 });
      }
  return out;
}

/** A point of a piece's own axes (x, y across its base's centre, z up its axis) in the world, leaning as it does. */
export function leant(p: { cx: number; cy: number; z: number; tilt?: number; roll?: number; angle?: number }, x: number, y: number, z: number): { x: number; y: number; z: number } {
  const t = p.tilt ?? 0;
  const r = p.roll ?? 0;
  const c = Math.cos(p.angle ?? 0);
  const s = Math.sin(p.angle ?? 0);
  const y1 = y * Math.cos(t) + z * Math.sin(t);
  const z1 = -y * Math.sin(t) + z * Math.cos(t);
  const x2 = x * Math.cos(r) + z1 * Math.sin(r);
  const z2 = -x * Math.sin(r) + z1 * Math.cos(r);
  return { x: p.cx + x2 * c - y1 * s, y: p.cy + x2 * s + y1 * c, z: p.z + z2 };
}

/** A leaning cylinder's rims, 16 points each, in the world. */
export function cylinderRims(p: Extract<Piece, { kind: 'cylinder' }>): { x: number; y: number; z: number }[] {
  return [0, 1].flatMap((top) => Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * 2 * Math.PI;
    const rr = top ? p.r2 : p.r;
    return leant(p, rr * Math.cos(a), rr * Math.sin(a), top ? p.h : 0);
  }));
}

/** An ellipsoid's surface, sampled (three rings and its poles), in the world. */
export function ellipsoidPoints(p: Extract<Piece, { kind: 'sphere' }>): { x: number; y: number; z: number }[] {
  const ry = p.ry ?? p.r;
  const out: { x: number; y: number; z: number }[] = [];
  for (const v of [-0.7, 0, 0.7])
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI;
      const c = Math.cos(Math.asin(v));
      out.push(leant(p, p.r * c * Math.cos(a), ry * c * Math.sin(a), (p.h / 2) * (1 + v)));
    }
  out.push(leant(p, 0, 0, 0), leant(p, 0, 0, p.h));
  return out;
}

/** The convex hull of points in plan, counter-clockwise (Andrew's monotone chain). */
export function hull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const ps = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: { x: number; y: number }[]) => {
    const out: { x: number; y: number }[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 1e-12) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/** A piece's lowest and highest point above the level's floor (a leaning box's by its corners). */
export function pieceSpan(p: Piece): { readonly bottom: number; readonly top: number } {
  if (p.kind === 'sphere' && p.ry !== undefined) {
    const zs = ellipsoidPoints(p).map((q) => q.z);
    return { bottom: Math.min(...zs), top: Math.max(...zs) };
  }
  if ((p.kind === 'box' || p.kind === 'cylinder') && (p.tilt || p.roll)) {
    const zs = (p.kind === 'box' ? boxCorners(p) : cylinderRims(p)).map((q) => q.z);
    return { bottom: Math.min(...zs), top: Math.max(...zs) };
  }
  return { bottom: p.z, top: p.z + p.h };
}

export function pieceOutline(p: Piece): { x: number; y: number }[] {
  if (p.kind === 'box' && (p.tilt || p.roll)) return hull(boxCorners(p));
  if (p.kind === 'cylinder' && (p.tilt || p.roll)) return hull(cylinderRims(p));
  if (p.kind === 'sphere' && p.ry !== undefined) return hull(ellipsoidPoints(p));
  if (p.kind === 'profile') return p.points.map((q) => ({ x: q.x, y: q.y }));
  if (p.kind === 'cylinder' || p.kind === 'sphere' || p.kind === 'revolve') {
    const r = p.kind === 'cylinder' ? Math.max(p.r, p.r2) : p.r;
    return Array.from({ length: 24 }, (_, k) => ({ x: p.cx + r * Math.cos((k / 24) * 2 * Math.PI), y: p.cy + r * Math.sin((k / 24) * 2 * Math.PI) }));
  }
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  if (p.kind === 'mesh') {
    // Its hull, from the unit square to its box.
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < p.mesh.outline.length; i += 2) {
      const a = (p.mesh.outline[i]! - 0.5) * p.w;
      const b = (p.mesh.outline[i + 1]! - 0.5) * p.d;
      out.push({ x: p.cx + a * c - b * s, y: p.cy + a * s + b * c });
    }
    return out;
  }
  return [
    [-p.w / 2, -p.d / 2],
    [p.w / 2, -p.d / 2],
    [p.w / 2, p.d / 2],
    [-p.w / 2, p.d / 2],
  ].map(([a, b]) => ({ x: p.cx + a! * c - b! * s, y: p.cy + a! * s + b! * c }));
}
