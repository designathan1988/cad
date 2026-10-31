// A section or an elevation drawn from the model (phase 10; elements/section): every solid as
// triangles (walls' blocks, doors' and windows' parts, the registry's kinds' meshes), seen square from
// the mark's right looking to its left, out to its depth. What its plane cuts is filled and outlined
// with the cut pen; what lies beyond is drawn far to near (each face filled with paper, so nearer faces
// hide what is behind them), with only its edges: where a face ends, or turns by more than 20° (as the
// 3D view's lines, EdgesGeometry's threshold), joints between pieces of one face left out. Levels are
// marked at their heights. A wall's layers are cut each in its material's colour and hatch, thin lines
// between them, the walls' outline with the cut pen. The doors and windows it cuts get their sill and
// head dimensioned, the rooms it crosses their names. Pure but for the painting.

import * as THREE from 'three';
import { type Doc, levelOf } from '../../project/doc';
import { type DerivedGeometry } from '../../project/derive';
import { hideCategories } from '../../project/derived-filters';
import { type Point2, sub } from '../../model/vector';
import type { Point3 } from '../../model/section-box';
import { eachSolid } from '../registry';
import type { KindSolid } from '../contract';
import { openingParts } from '../opening/parts';
import { insideRing, type RoomSolid } from '../room/derive';
import { lookOf, type SectionMark } from './schema';
import type { CutPattern } from '../material/schema';
import { paperHatch } from '../material/hatch';

/** A solid's triangles, in plan coordinates and heights. */
export interface Solid3 {
  /** Fills and lines are worked out per group: the walls' layers by material, each element's own. */
  readonly group: string;
  readonly tris: readonly (readonly [Point3, Point3, Point3])[];
  /** What its cut is filled with: its material's colour and cut pattern (a wall layer's); the cut fill without. */
  readonly cut?: { readonly color: string; readonly pattern: CutPattern };
  /** The groups cut together whose outline is drawn with the cut pen (all the walls' layers); its own without. */
  readonly outline?: string;
  /** A door's or window's part: its opening's floor, bottom and head (absolute heights), dimensioned where the plane cuts it. */
  readonly opening?: { readonly id: string; readonly floor: number; readonly bottom: number; readonly top: number };
}

/** A face beyond the plane, in the drawing's (along, height) coordinates (m), with its edges to draw. */
export interface SeenFace {
  readonly poly: readonly Point2[];
  readonly depth: number;
  readonly edges: readonly (readonly [Point2, Point2])[];
}

export interface SectionDrawing {
  /** Far to near. */
  readonly faces: readonly SeenFace[];
  /**
   * What the plane cuts, per group: its closed outlines (filled) and its cut segments (outlined). A layer
   * of a wall has its material's fill and a thin line ('fine'); the walls' outline over all their layers
   * is lines alone with the cut pen; any other group, the cut fill and the cut pen.
   */
  readonly cuts: readonly {
    readonly loops: readonly (readonly Point2[])[];
    readonly segments: readonly (readonly [Point2, Point2])[];
    readonly fill?: { readonly color: string; readonly pattern: CutPattern };
    readonly pen?: 'fine';
  }[];
  /** Its extent (m): along the line and up. */
  readonly box: { readonly min: Point2; readonly max: Point2 } | null;
  /** The extent of what its plane cuts (the building, not the ground beyond it); null when it cuts nothing. */
  readonly cutBox?: { readonly min: Point2; readonly max: Point2 } | null;
  readonly levels: readonly { readonly name: string; readonly z: number }[];
  /** Where its ground line is and its heights are measured from: 0, or a room's elevation's level. */
  readonly base: number;
  /** The doors and windows its plane cuts: the far side of their cut along the line, their floor, sill and head. */
  readonly openings: readonly { readonly at: number; readonly floor: number; readonly bottom: number; readonly top: number }[];
  /** The rooms its line crosses: each name in the middle of its longest stretch, half the room's height up. */
  readonly rooms: readonly { readonly id: string; readonly number: string; readonly name: string; readonly at: Point2 }[];
  /** The line's length (m). */
  readonly length: number;
}

const topAt = (b: { bottom: number; top: number; plane?: { a: number; b: number; c: number } }, q: Point2) =>
  b.plane ? Math.max(b.bottom, Math.min(b.top, b.plane.a * q.x + b.plane.b * q.y + b.plane.c)) : b.top;

/** An upright prism over a convex polygon as triangles; its top on a plane when it has one. */
export function prismTriangles(poly: readonly Point2[], b: { bottom: number; top: number; plane?: { a: number; b: number; c: number } }): [Point3, Point3, Point3][] {
  const n = poly.length;
  const lo = (p: Point2): Point3 => ({ x: p.x, y: p.y, z: b.bottom });
  const hi = (p: Point2): Point3 => ({ x: p.x, y: p.y, z: topAt(b, p) });
  const out: [Point3, Point3, Point3][] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % n]!;
    out.push([lo(p), lo(q), hi(q)], [lo(p), hi(q), hi(p)]);
  }
  for (let i = 1; i < n - 1; i++) {
    out.push([hi(poly[0]!), hi(poly[i]!), hi(poly[i + 1]!)], [lo(poly[0]!), lo(poly[i + 1]!), lo(poly[i]!)]);
  }
  return out;
}

/** A three.js geometry's triangles (x, height, −y), raised by y, in plan coordinates. */
export function geometryTriangles(geo: THREE.BufferGeometry, y: number): [Point3, Point3, Point3][] {
  const pos = geo.getAttribute('position');
  if (!pos) return [];
  const index = geo.getIndex();
  const at = (i: number): Point3 => ({ x: pos.getX(i), y: -pos.getZ(i), z: pos.getY(i) + y });
  const count = index ? index.count : pos.count;
  const out: [Point3, Point3, Point3][] = [];
  for (let k = 0; k + 2 < count; k += 3) {
    const i = index ? index.getX(k) : k;
    const j = index ? index.getX(k + 1) : k + 1;
    const l = index ? index.getX(k + 2) : k + 2;
    out.push([at(i), at(j), at(l)]);
  }
  return out;
}

/** p turned about the axis through o along a level `axis` by `angle` (Rodrigues). */
function turned(p: Point3, o: Point3, axis: Point2, angle: number): Point3 {
  const len = Math.hypot(axis.x, axis.y) || 1;
  const k = { x: axis.x / len, y: axis.y / len, z: 0 };
  const v = { x: p.x - o.x, y: p.y - o.y, z: p.z - o.z };
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = k.x * v.x + k.y * v.y;
  const cross = { x: k.y * v.z, y: -k.x * v.z, z: k.x * v.y - k.y * v.x };
  return {
    x: o.x + v.x * c + cross.x * s + k.x * kv * (1 - c),
    y: o.y + v.y * c + cross.y * s + k.y * kv * (1 - c),
    z: o.z + v.z * c + cross.z * s,
  };
}

/** Every solid of the model shown (the categories hidden left out), as triangles. */
export function modelSolids(doc: Doc, g: DerivedGeometry, hidden: ReadonlySet<string> = new Set()): Solid3[] {
  const shown = hideCategories(g, new Set([...hidden, 'guides']) as Parameters<typeof hideCategories>[1]);
  void doc;
  const out: Solid3[] = [];
  // The walls' layers by material, the walls' outline over them all: where two pieces of one material
  // meet, no line; between two materials, a thin one.
  const byMaterial = new Map<string, { tris: [Point3, Point3, Point3][]; color: string; pattern: CutPattern }>();
  for (const s of shown.solids.values())
    for (const b of s.blocks) {
      const m = s.materials[b.layerIndex];
      const key = m?.id ?? '';
      const entry = byMaterial.get(key) ?? { tris: [], color: m?.color ?? '', pattern: m?.cut ?? 'solid' };
      entry.tris.push(...prismTriangles(b.polygon, b));
      byMaterial.set(key, entry);
    }
  for (const [id, e] of byMaterial) out.push({ group: `walls:${id}`, tris: e.tris, ...(e.color ? { cut: { color: e.color, pattern: e.pattern } } : {}), outline: 'walls' });
  for (const o of shown.openings.values()) {
    if (!o.frame) continue;
    openingParts(o, o.frame, false).forEach((part, i) => {
      let tris = prismTriangles(part.polygon, part);
      if (part.turn) {
        const { origin, axis, angle } = part.turn;
        tris = tris.map((t) => t.map((p) => turned(p, origin, axis, angle)) as [Point3, Point3, Point3]);
      }
      out.push({ group: `${o.opening.id}:${i}`, tris, opening: { id: o.opening.id, floor: o.bottom - o.opening.sill, bottom: o.bottom, top: o.top } });
    });
  }
  for (const x of eachSolid(shown.kinds)) {
    if (!x.kind.solid || x.levelId === null) continue;
    const made = x.kind.solid(x.solid);
    if (!made) continue;
    (Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid]).forEach((part, i) => {
      out.push({ group: `${x.id}:${i}`, tris: geometryTriangles(part.geometry, part.y) });
    });
  }
  return out;
}

/** Keys to a tenth of a millimetre: the same point read twice is one. */
const Q = 1e4;
const key3 = (p: Point3) => `${Math.round(p.x * Q)},${Math.round(p.y * Q)},${Math.round(p.z * Q)}`;
const sub3 = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot3 = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a: Point3, b: Point3): Point3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit3 = (a: Point3): Point3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};
/** Smoother than this turn (cos 20°) is one face. */
const SMOOTH = Math.cos((20 * Math.PI) / 180);

/**
 * The parts of each triangle's edges that are lines: of an edge, what no other face of its group goes on
 * from (a face beyond it, its other side within 20°). Per triangle, per edge, the stretches [t0, t1] of
 * it (0 at its start, 1 at its end).
 */
export function featureEdges(tris: readonly (readonly [Point3, Point3, Point3])[]): (readonly (readonly [number, number])[])[][] {
  // Each edge as a stretch of a line: its line's key, its interval along it, and the way into its face.
  type Occ = { tri: number; edge: number; t0: number; t1: number; flip: boolean; into: Point3 };
  const lines = new Map<string, Occ[]>();
  const result: (readonly (readonly [number, number])[])[][] = tris.map(() => [[], [], []]);
  tris.forEach((t, ti) => {
    const normal = cross3(sub3(t[1], t[0]), sub3(t[2], t[0]));
    if (Math.hypot(normal.x, normal.y, normal.z) < 1e-12) return;
    for (let e = 0; e < 3; e++) {
      const a = t[e]!;
      const b = t[(e + 1) % 3]!;
      const c = t[(e + 2) % 3]!;
      let d = sub3(b, a);
      const len = Math.hypot(d.x, d.y, d.z);
      if (len < 1e-9) continue;
      d = unit3(d);
      // The line's direction one way round, whichever way the edge runs.
      const flip = d.x < -1e-9 || (Math.abs(d.x) <= 1e-9 && (d.y < -1e-9 || (Math.abs(d.y) <= 1e-9 && d.z < 0)));
      const u = flip ? { x: -d.x, y: -d.y, z: -d.z } : d;
      const foot = sub3(a, { x: u.x * dot3(a, u), y: u.y * dot3(a, u), z: u.z * dot3(a, u) });
      const k = `${Math.round(u.x * Q)},${Math.round(u.y * Q)},${Math.round(u.z * Q)}|${key3(foot)}`;
      const ta = dot3(a, u);
      const tb = dot3(b, u);
      // Into the face: square to the edge, toward its third corner.
      const ac = sub3(c, a);
      const into = unit3(sub3(ac, { x: d.x * dot3(ac, d), y: d.y * dot3(ac, d), z: d.z * dot3(ac, d) }));
      const list = lines.get(k) ?? [];
      list.push({ tri: ti, edge: e, t0: Math.min(ta, tb), t1: Math.max(ta, tb), flip: ta > tb, into });
      lines.set(k, list);
    }
  });
  for (const list of lines.values()) {
    for (const o of list) {
      // What goes on from it: faces on the line whose way in is (nearly) the opposite of its own.
      const covers = list.filter((x) => x !== o && dot3(x.into, o.into) < -SMOOTH && x.t1 > o.t0 && x.t0 < o.t1).map((x) => [Math.max(x.t0, o.t0), Math.min(x.t1, o.t1)] as const);
      covers.sort((p, q) => p[0] - q[0]);
      const free: [number, number][] = [];
      let at = o.t0;
      for (const [c0, c1] of covers) {
        if (c0 > at + 1e-7) free.push([at, c0]);
        at = Math.max(at, c1);
      }
      if (o.t1 > at + 1e-7) free.push([at, o.t1]);
      // As fractions of the edge from its own start.
      const span = o.t1 - o.t0;
      result[o.tri]![o.edge] = free.map(([p, q]) => {
        const f0 = (p - o.t0) / span;
        const f1 = (q - o.t0) / span;
        return o.flip ? ([1 - f1, 1 - f0] as const) : ([f0, f1] as const);
      });
    }
  }
  return result;
}

/** A vertex in the drawing's frame: along the line, beyond it, up. */
type V = { readonly s: number; readonly d: number; readonly z: number };
/** A clipped polygon's vertices, each with what the edge from it is: 0 nothing, 1 an edge of the face, 2 the cut. */
type Ring = { v: V; f: 0 | 1 | 2 }[];

/** The ring kept where `side(v)` ≥ 0, the new edges along the clip marked `mark`. */
function clipRing(ring: Ring, side: (v: V) => number, mark: 0 | 2): Ring {
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const sp = side(p.v);
    const sq = side(q.v);
    const inP = sp >= 0;
    const inQ = sq >= 0;
    if (inP) out.push({ v: p.v, f: p.f });
    if (inP !== inQ) {
      const k = sp / (sp - sq);
      const v = { s: p.v.s + (q.v.s - p.v.s) * k, d: p.v.d + (q.v.d - p.v.d) * k, z: p.v.z + (q.v.z - p.v.z) * k };
      out.push({ v, f: inQ ? p.f : mark });
    }
  }
  return out;
}

/** A segment's part where `side` ≥ 0, as fractions [0, 1] of it; null when none. */
function clipSegment(a: V, b: V, sides: readonly ((v: V) => number)[]): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  for (const side of sides) {
    const sa = side(a);
    const sb = side(b);
    if (sa < 0 && sb < 0) return null;
    if (sa < 0) t0 = Math.max(t0, sa / (sa - sb));
    else if (sb < 0) t1 = Math.min(t1, sa / (sa - sb));
  }
  return t1 - t0 > 1e-9 ? [t0, t1] : null;
}

/**
 * The outline of what is cut: of the cut segments, the stretches only one piece cuts. Where two pieces
 * meet (a wall's layers side by side, its blocks one over another, two walls end to end) both cut the
 * same line, each in stretches of its own (its faces' triangles split it elsewhere): inside the cut, not
 * its outline. Worked out on each line, the stretches counted.
 */
export function outlineOf(segments: readonly (readonly [Point2, Point2])[]): [Point2, Point2][] {
  const lines = new Map<string, { d: Point2; offset: number; spans: [number, number][] }>();
  for (const [a, b] of segments) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-7) continue;
    let d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    if (d.x < -1e-9 || (Math.abs(d.x) <= 1e-9 && d.y < 0)) d = { x: -d.x, y: -d.y };
    const offset = d.x * a.y - d.y * a.x;
    const k = `${Math.round(d.x * Q)},${Math.round(d.y * Q)},${Math.round(offset * Q)}`;
    const line = lines.get(k) ?? { d, offset, spans: [] };
    const ta = a.x * d.x + a.y * d.y;
    const tb = b.x * d.x + b.y * d.y;
    line.spans.push([Math.min(ta, tb), Math.max(ta, tb)]);
    lines.set(k, line);
  }
  const out: [Point2, Point2][] = [];
  for (const { d, offset, spans } of lines.values()) {
    const at = (t: number): Point2 => ({ x: -d.y * offset + d.x * t, y: d.x * offset + d.y * t });
    const cuts = [...new Set(spans.flat())].sort((p, q) => p - q).filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-7);
    let from: number | null = null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const lo = cuts[i]!;
      const hi = cuts[i + 1]!;
      const n = spans.filter(([s0, s1]) => s0 <= lo + 1e-7 && s1 >= hi - 1e-7).length;
      if (n === 1) from ??= lo;
      else if (from !== null) {
        out.push([at(from), at(lo)]);
        from = null;
      }
    }
    if (from !== null) out.push([at(from), at(cuts.at(-1)!)]);
  }
  return out;
}

/** The closed outlines the cut segments make, end to end (an open run left out of the fill). */
export function loopsOf(segments: readonly (readonly [Point2, Point2])[]): Point2[][] {
  const k = (p: Point2) => `${Math.round(p.x * Q)},${Math.round(p.y * Q)}`;
  const from = new Map<string, number[]>();
  segments.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const list = from.get(k(p)) ?? [];
      list.push(i);
      from.set(k(p), list);
    }
  });
  const used = new Set<number>();
  const loops: Point2[][] = [];
  for (let i = 0; i < segments.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    const loop: Point2[] = [segments[i]![0], segments[i]![1]];
    const first = k(loop[0]!);
    let closed = false;
    for (let guard = 0; guard < segments.length; guard++) {
      const end = loop.at(-1)!;
      if (k(end) === first) {
        closed = true;
        loop.pop();
        break;
      }
      const next = (from.get(k(end)) ?? []).find((j) => !used.has(j));
      if (next === undefined) break;
      used.add(next);
      const [a, b] = segments[next]!;
      loop.push(k(a) === k(end) ? b : a);
    }
    if (closed && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** The stretches (from, to along the line) of a line from `start` along `dir` for `len` inside a ring; the longest. */
function longestInside(ring: readonly Point2[], start: Point2, dir: Point2, len: number): [number, number] | null {
  const ts = [0, len];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const e = sub(ring[(i + 1) % ring.length]!, a);
    const den = dir.x * e.y - dir.y * e.x;
    if (Math.abs(den) < 1e-12) continue;
    const q = sub(a, start);
    const t = (q.x * e.y - q.y * e.x) / den;
    const u = (q.x * dir.y - q.y * dir.x) / den;
    if (u >= 0 && u <= 1 && t > 0 && t < len) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  let best: [number, number] | null = null;
  let run: [number, number] | null = null;
  for (let i = 1; i < ts.length; i++) {
    const t0 = ts[i - 1]!;
    const t1 = ts[i]!;
    if (t1 - t0 < 1e-9) continue;
    const mid = (t0 + t1) / 2;
    run = insideRing(ring, { x: start.x + dir.x * mid, y: start.y + dir.y * mid }) ? [run?.[0] ?? t0, t1] : null;
    if (run && (!best || run[1] - run[0] > best[1] - best[0])) best = run;
  }
  return best;
}

/** The section or elevation as a drawing: its faces beyond, what it cuts, its extent, the levels, the openings it cuts and the rooms it crosses. */
export function sectionDrawing(doc: Doc, solids: readonly Solid3[], m: SectionMark, rooms: ReadonlyMap<string, RoomSolid> = new Map()): SectionDrawing {
  const look = lookOf(m);
  const len = Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y);
  const along = { x: (m.end.x - m.start.x) / len, y: (m.end.y - m.start.y) / len };
  const frame = (p: Point3): V => {
    const dx = p.x - m.start.x;
    const dy = p.y - m.start.y;
    return { s: dx * along.x + dy * along.y, d: dx * look.x + dy * look.y, z: p.z };
  };
  // Kept: from the line out to its depth, and between its ends; a room's elevation, its level's floor to ceiling.
  const own = m.levelId === undefined ? undefined : levelOf(doc, m.levelId);
  const sides: ((v: V) => number)[] = [(v) => m.depth - v.d, (v) => v.s, (v) => len - v.s];
  if (own) sides.push((v) => v.z - own.elevation, (v) => own.elevation + own.height - v.z);
  const faces: SeenFace[] = [];
  const cuts: { loops: Point2[][]; segments: [Point2, Point2][]; fill?: { color: string; pattern: CutPattern }; pen?: 'fine' }[] = [];
  // The cut segments of the groups outlined together (the walls' layers), for their common outline.
  const together = new Map<string, [Point2, Point2][]>();
  const openings = new Map<string, { at: number; floor: number; bottom: number; top: number }>();
  let min ={ x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  const grow = (p: Point2) => {
    min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y) };
    max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y) };
  };
  const flat = (v: V): Point2 => ({ x: v.s, y: v.z });
  for (const solid of solids) {
    const lines = featureEdges(solid.tris);
    const cutSegments: [Point2, Point2][] = [];
    solid.tris.forEach((t, ti) => {
      const vs = t.map(frame) as [V, V, V];
      // Wholly in front of the line, or past its depth or its ends: nothing.
      if (vs.every((v) => v.d < 0) || sides.some((side) => vs.every((v) => side(v) < 0))) return;
      // A face on a room's ceiling facing down, or on its floor facing up, is of what stands outside (a wall
      // of the level above on the walls below): it would meet their tops and wipe out their outline.
      if (own) {
        const on = (z: number) => vs.every((v) => Math.abs(v.z - z) < 1e-9);
        const up = (t[1].x - t[0].x) * (t[2].y - t[0].y) - (t[1].y - t[0].y) * (t[2].x - t[0].x);
        if ((on(own.elevation + own.height) && up < 0) || (on(own.elevation) && up > 0)) return;
      }
      let ring: Ring = vs.map((v) => ({ v, f: 1 as const }));
      ring = clipRing(ring, (v) => v.d, 2);
      for (const side of sides) ring = clipRing(ring, side, 0);
      if (ring.length < 3) return;
      for (let i = 0; i < ring.length; i++) if (ring[i]!.f === 2) cutSegments.push([flat(ring[i]!.v), flat(ring[(i + 1) % ring.length]!.v)]);
      // The face's lines: its edges' line stretches, clipped as the face is.
      const edges: [Point2, Point2][] = [];
      lines[ti]!.forEach((stretches, e) => {
        const a = vs[e]!;
        const b = vs[(e + 1) % 3]!;
        for (const [f0, f1] of stretches) {
          const p = { s: a.s + (b.s - a.s) * f0, d: a.d + (b.d - a.d) * f0, z: a.z + (b.z - a.z) * f0 };
          const q = { s: a.s + (b.s - a.s) * f1, d: a.d + (b.d - a.d) * f1, z: a.z + (b.z - a.z) * f1 };
          const c = clipSegment(p, q, [(v) => v.d, ...sides]);
          if (!c) continue;
          const at = (k: number): Point2 => ({ x: p.s + (q.s - p.s) * k, y: p.z + (q.z - p.z) * k });
          edges.push([at(c[0]), at(c[1])]);
        }
      });
      const poly = ring.map((r) => flat(r.v));
      for (const p of poly) grow(p);
      faces.push({ poly, depth: ring.reduce((sum, r) => sum + r.v.d, 0) / ring.length, edges });
    });
    const outline = outlineOf(cutSegments);
    if (outline.length > 0 && solid.opening) {
      const { id, ...heights } = solid.opening;
      const at = Math.max(...outline.flat().map((p) => p.x), openings.get(id)?.at ?? -Infinity);
      openings.set(id, { at, ...heights });
    }
    if (outline.length > 0) {
      if (solid.outline) {
        cuts.push({ loops: loopsOf(outline), segments: outline, ...(solid.cut ? { fill: solid.cut } : {}), pen: 'fine' });
        together.set(solid.outline, [...(together.get(solid.outline) ?? []), ...cutSegments]);
      } else cuts.push({ loops: loopsOf(outline), segments: outline });
    }
  }
  // Over the layers, the walls' outline: where two layers meet both cut the line, so it is inside.
  for (const segments of together.values()) {
    const outline = outlineOf(segments);
    if (outline.length > 0) cuts.push({ loops: [], segments: outline });
  }
  faces.sort((a, b) => b.depth - a.depth);
  const levels = (own ? [own] : [...doc.levels].sort((a, b) => a.elevation - b.elevation)).map((l) => ({ name: l.name, z: l.elevation }));
  const cutPoints = cuts.flatMap((c) => c.segments.flat());
  const cutBox =
    cutPoints.length > 0
      ? { min: { x: Math.min(...cutPoints.map((p) => p.x)), y: Math.min(...cutPoints.map((p) => p.y)) }, max: { x: Math.max(...cutPoints.map((p) => p.x)), y: Math.max(...cutPoints.map((p) => p.y)) } }
      : null;
  const crossed: SectionDrawing['rooms'][number][] = [];
  for (const [id, r] of m.kind === 'section' ? rooms : []) {
    const level = levelOf(doc, r.room.levelId);
    if (!r.enclosed || r.outline.length < 3 || !level) continue;
    const stretch = longestInside(r.outline, m.start, along, len);
    if (!stretch) continue;
    crossed.push({ id, number: r.room.number, name: r.room.name, at: { x: (stretch[0] + stretch[1]) / 2, y: level.elevation + (r.room.height ?? level.height) / 2 } });
  }
  return { faces, cuts, box: Number.isFinite(min.x) ? { min, max } : null, cutBox, base: own?.elevation ?? 0, levels, openings: [...openings.values()].sort((a, b) => a.at - b.at), rooms: crossed, length: len };
}

/**
 * A section's dimensions: up its left side, the heights from the ground to each level above it and to
 * the top of what it shows (each stretch its own dimension); under it, the length of what it cuts (the
 * building, not the ground beyond it), or of all it shows when it cuts nothing. Null without a drawing.
 */
export function sectionDims(d: Pick<SectionDrawing, 'box' | 'levels' | 'cutBox'> & { readonly base?: number }): { heights: number[]; along: [number, number] } | null {
  if (!d.box) return null;
  const top = d.box.max.y;
  const base = d.base ?? 0;
  const marks = [base, ...d.levels.map((l) => l.z).filter((z) => z > base + 1e-6 && z < top - 1e-6), top].filter((z, i, all) => i === 0 || z - all[i - 1]! > 1e-6);
  const span = d.cutBox ?? d.box;
  return { heights: marks, along: [span.min.x, span.max.x] };
}

/** How a drawing is painted: model (along, up) to paper (mm), the pens (mm) and the colours. */
export interface SectionPaint {
  readonly toPaper: (p: Point2) => Point2;
  readonly cutPen: number;
  readonly seenPen: number;
  readonly finePen: number;
  readonly ink: string;
  readonly cutFill: string;
  readonly paper: string;
  readonly family: string;
  /** Text height (mm). */
  readonly text: number;
  /** A level's name and height as said: "Térreo +0,00". */
  readonly levelText: (name: string, z: number) => string;
  /** The page's pixels per millimetre: a layer's hatch drawn sharp at it. */
  readonly pxPerMm?: number;
  /** A length as dimensions write it ("2,80"); none: no dimensions drawn. */
  readonly lengthText?: (m: number) => string;
  /** A room's name as the plan writes it ("3 · Sala"); none: no names drawn. */
  readonly roomText?: (number: string, name: string) => string;
}

/** The spacing of a cut's hatch on paper (mm), at any scale, as a section's hatch is drawn by hand. */
const HATCH_MM = 2;

/** The drawing on a context in paper millimetres. */
export function paintSection(ctx: CanvasRenderingContext2D, d: SectionDrawing, p: SectionPaint): void {
  const path = (poly: readonly Point2[]) => {
    ctx.beginPath();
    poly.forEach((q, i) => {
      const s = p.toPaper(q);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Far to near: each face covers what is behind it, then draws its own lines.
  for (const f of d.faces) {
    path(f.poly);
    ctx.fillStyle = p.paper;
    ctx.fill();
    // A hair of paper round it too, so its neighbours' seams do not let lines behind show through.
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = p.finePen * 0.5;
    ctx.stroke();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = p.seenPen;
    ctx.beginPath();
    for (const [a, b] of f.edges) {
      const s = p.toPaper(a);
      const e = p.toPaper(b);
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
  }
  // What is cut: filled (a layer in its material's colour, its hatch over it), then outlined: a layer's
  // edges thin, the walls' outline and any other cut with the cut pen.
  for (const c of d.cuts) {
    ctx.beginPath();
    for (const loop of c.loops) {
      loop.forEach((q, i) => {
        const s = p.toPaper(q);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
    }
    if (c.loops.length > 0) {
      ctx.fillStyle = c.fill?.color ?? p.cutFill;
      ctx.fill('evenodd');
      const hatch = c.fill ? paperHatch(ctx, c.fill.pattern, p.ink, HATCH_MM, p.pxPerMm ?? 12, p.finePen * 0.7) : null;
      if (hatch) {
        ctx.fillStyle = hatch;
        ctx.fill('evenodd');
      }
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = c.pen === 'fine' ? p.finePen : p.cutPen;
    ctx.beginPath();
    for (const [a, b] of c.segments) {
      const s = p.toPaper(a);
      const e = p.toPaper(b);
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
  }
  // The ground, a little past the drawing both ways, and each level's mark at the right.
  if (d.box) {
    const left = p.toPaper({ x: d.box.min.x, y: d.base });
    const right = p.toPaper({ x: d.box.max.x, y: d.base });
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = p.cutPen * 1.5;
    ctx.beginPath();
    ctx.moveTo(left.x - 5, left.y);
    ctx.lineTo(right.x + 5, right.y);
    ctx.stroke();
    ctx.font = `400 ${p.text}px ${p.family}`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.lineWidth = p.finePen;
    for (const l of d.levels) {
      const at = p.toPaper({ x: d.box.max.x, y: l.z });
      const x = right.x + 3;
      ctx.setLineDash([2, 1]);
      ctx.beginPath();
      ctx.moveTo(right.x - 2, at.y);
      ctx.lineTo(x + 18, at.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // The level mark: a triangle standing on the line.
      ctx.beginPath();
      ctx.moveTo(x, at.y);
      ctx.lineTo(x - 1.2, at.y - 1.8);
      ctx.lineTo(x + 1.2, at.y - 1.8);
      ctx.closePath();
      ctx.fillStyle = p.ink;
      ctx.fill();
      ctx.fillText(p.levelText(l.name, l.z), x + 2, at.y - 0.4);
    }
  }
  // The rooms' names inside, on a hair of paper so the lines beyond do not cross them.
  if (p.roomText) {
    ctx.font = `400 ${p.text}px ${p.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const r of d.rooms) {
      const at = p.toPaper(r.at);
      const s = p.roomText(r.number, r.name);
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = p.text * 0.4;
      ctx.strokeText(s, at.x, at.y);
      ctx.fillStyle = p.ink;
      ctx.fillText(s, at.x, at.y);
    }
  }
  if (p.lengthText) {
    const dims = sectionDims(d);
    if (dims) paintDims(ctx, dims, p, p.lengthText);
    // Each door and window it cuts: up its far side, 3 mm out, from its floor to its sill (a window's) and its head.
    for (const o of d.openings) {
      const zs = [o.floor, ...(o.bottom - o.floor > 1e-6 ? [o.bottom] : []), o.top];
      upChain(ctx, p.toPaper({ x: o.at, y: 0 }).x + 3, zs, p, p.lengthText, [-2.5, 0.5]);
    }
  }
  ctx.restore();
}

/**
 * A chain of heights up the paper line at x: a tick at 45° at each, each stretch's value beside it on its
 * left, turned to read upward, and an extension line at each height from x + ext[0] to x + ext[1] (mm).
 */
function upChain(ctx: CanvasRenderingContext2D, x: number, zs: readonly number[], p: SectionPaint, text: (m: number) => string, ext: readonly [number, number]): void {
  const tick = 1;
  const ys = zs.map((z) => p.toPaper({ x: 0, y: z }).y);
  ctx.save();
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = p.finePen;
  ctx.font = `400 ${p.text}px ${p.family}`;
  ctx.beginPath();
  ctx.moveTo(x, ys[0]!);
  ctx.lineTo(x, ys.at(-1)!);
  for (const y of ys) {
    ctx.moveTo(x - tick, y + tick);
    ctx.lineTo(x + tick, y - tick);
    ctx.moveTo(x + ext[0], y);
    ctx.lineTo(x + ext[1], y);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let i = 1; i < ys.length; i++) {
    ctx.save();
    ctx.translate(x - 0.8, (ys[i - 1]! + ys[i]!) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(text(zs[i]! - zs[i - 1]!), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** The section's dimensions on paper: ticks at 45°, the values over their lines, upright ones turned. */
function paintDims(ctx: CanvasRenderingContext2D, dims: { heights: number[]; along: [number, number] }, p: SectionPaint, text: (m: number) => string): void {
  const tick = 1;
  ctx.save();
  ctx.strokeStyle = p.ink;
  ctx.fillStyle = p.ink;
  ctx.lineWidth = p.finePen;
  ctx.font = `400 ${p.text}px ${p.family}`;
  // Up the left side, 8 mm out from the drawing.
  upChain(ctx, p.toPaper({ x: dims.along[0], y: 0 }).x - 8, dims.heights, p, text, [1.5, 4]);
  // Under the ground line, 8 mm down: the whole length.
  const a = p.toPaper({ x: dims.along[0], y: dims.heights[0]! });
  const b = p.toPaper({ x: dims.along[1], y: dims.heights[0]! });
  const y = a.y + 8;
  ctx.beginPath();
  ctx.moveTo(a.x, y);
  ctx.lineTo(b.x, y);
  for (const q of [a.x, b.x]) {
    ctx.moveTo(q - tick, y + tick);
    ctx.lineTo(q + tick, y - tick);
    ctx.moveTo(q, a.y + 1.5);
    ctx.lineTo(q, y + 1.5);
  }
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text(dims.along[1] - dims.along[0]), (a.x + b.x) / 2, y - 0.6);
  ctx.restore();
}
