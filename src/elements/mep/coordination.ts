// Coordination of the services with the building (docs/plano-de-escopo.md, phase 13): the runs that go
// through a column or a beam (conflitos com a estrutura) or touch a run of another discipline; the structure as an analytic model (nodes and
// bars, each beam's supports) with first sizing warnings; the wet rooms' waterproofing; and the
// isometric drawing of the runs. Only warnings: the structure's design stays with its engineer. Pure.

import type { Doc } from '../../app/document';
import type { DerivedGeometry } from '../../app/geometry';
import type { Point2 } from '../../core/vector';
import { insideRing } from '../room/derive';
import type { BeamSolid } from '../kinds/beam';
import type { ColumnSolid } from '../kinds/column';
import { networksOf } from './network';
import { GROUP_OF, type MepRun, systemIn } from './schema';

export interface Clash {
  readonly runId: string;
  /** The column or beam it goes through, or the other run it touches. */
  readonly elementId: string;
  /** Where (plan) and how high (m). */
  readonly at: Point2;
  readonly z: number;
}

/** The least distance from p to a ring's sides. */
function toRing(p: Point2, ring: readonly Point2[]): number {
  let least = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    least = Math.min(least, Math.hypot(p.x - a.x - dx * k, p.y - a.y - dy * k));
  }
  return least;
}

/** The structure's bodies: each column's and beam's outline and height range. */
function structure(g: DerivedGeometry): { id: string; outline: readonly Point2[]; bottom: number; top: number }[] {
  const out: { id: string; outline: readonly Point2[]; bottom: number; top: number }[] = [];
  for (const s of (g.kinds.get('columns')?.values() ?? []) as Iterable<ColumnSolid>) out.push({ id: s.column.id, outline: s.outline, bottom: s.bottom, top: s.top });
  for (const s of (g.kinds.get('beams')?.values() ?? []) as Iterable<BeamSolid>) out.push({ id: s.beam.id, outline: s.outline, bottom: s.bottom, top: Math.max(s.top, s.startTop, s.endTop) });
  return out;
}

type P3 = { readonly x: number; readonly y: number; readonly z: number };

/** The nearest points of two segments in space, and how far apart they are. */
function nearest(p0: P3, p1: P3, q0: P3, q1: P3): { d: number; at: P3 } {
  const u = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
  const v = { x: q1.x - q0.x, y: q1.y - q0.y, z: q1.z - q0.z };
  const w = { x: p0.x - q0.x, y: p0.y - q0.y, z: p0.z - q0.z };
  const dot = (m: P3, n: P3) => m.x * n.x + m.y * n.y + m.z * n.z;
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w);
  const e = dot(v, w);
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  // Ericson, Real-Time Collision Detection 5.1.9: a point (or two), else the nearest of the lines held
  // to the first segment, then the second's parameter held too and the first's taken again from it.
  const eps = 1e-12;
  let s = 0;
  let t = 0;
  if (a <= eps && c <= eps) (s = 0), (t = 0);
  else if (a <= eps) (s = 0), (t = clamp(e / c));
  else if (c <= eps) (t = 0), (s = clamp(-d / a));
  else {
    const den = a * c - b * b;
    s = den > eps ? clamp((b * e - c * d) / den) : 0;
    t = (b * s + e) / c;
    if (t < 0) (t = 0), (s = clamp(-d / a));
    else if (t > 1) (t = 1), (s = clamp((b - d) / a));
  }
  const P = { x: p0.x + u.x * s, y: p0.y + u.y * s, z: p0.z + u.z * s };
  const Q = { x: q0.x + v.x * t, y: q0.y + v.y * t, z: q0.z + v.z * t };
  return { d: Math.hypot(P.x - Q.x, P.y - Q.y, P.z - Q.z), at: { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2, z: (P.z + Q.z) / 2 } };
}

/**
 * Where a run passes through the structure (walked every 2 cm, its pipe's radius counted), and where
 * runs of two groups that do not join touch (a conduit against a pipe, a duct against a conduit: the
 * gap between them less than their radii). Runs of one group meet on purpose (network.ts). One clash
 * per run and element (or other run).
 */
export function clashesOf(doc: Doc, g: DerivedGeometry): Clash[] {
  const bodies = structure(g);
  const elevation = new Map(doc.levels.map((l) => [l.id, l.elevation]));
  const out: Clash[] = [];
  const group = (r: MepRun) => {
    const s = systemIn(doc, r.systemId);
    return s ? GROUP_OF[s.discipline] : r.systemId;
  };
  const paths = doc.mepRuns.map((r) => ({ r, group: group(r), pts: r.points.map((v) => ({ x: v.x, y: v.y, z: v.z + (elevation.get(r.levelId) ?? 0) })) }));
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) {
      const A = paths[i]!;
      const B = paths[j]!;
      if (A.group === B.group) continue;
      const gap = (A.r.diameter + B.r.diameter) / 2;
      let found: P3 | null = null;
      for (let k = 1; k < A.pts.length && !found; k++)
        for (let m = 1; m < B.pts.length && !found; m++) {
          const n = nearest(A.pts[k - 1]!, A.pts[k]!, B.pts[m - 1]!, B.pts[m]!);
          if (n.d < gap) found = n.at;
        }
      if (found) out.push({ runId: A.r.id, elementId: B.r.id, at: { x: found.x, y: found.y }, z: found.z });
    }
  if (bodies.length === 0) return out;
  for (const r of doc.mepRuns) {
    const e = elevation.get(r.levelId) ?? 0;
    const radius = r.diameter / 2;
    const hit = new Set<string>();
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1]!;
      const b = r.points[i]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const steps = Math.max(1, Math.ceil(len / 0.02));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const z = a.z + (b.z - a.z) * t + e;
        for (const body of bodies) {
          if (hit.has(body.id) || z < body.bottom - radius || z > body.top + radius) continue;
          // Inside the body, deeper than the pipe's radius: a touch at its face is not a clash.
          if (insideRing(body.outline, p) && toRing(p, body.outline) > radius * 0.5) {
            hit.add(body.id);
            out.push({ runId: r.id, elementId: body.id, at: p, z });
          }
        }
      }
    }
  }
  return out;
}

export interface Bar {
  readonly id: string;
  readonly kind: 'column' | 'beam';
  readonly a: { x: number; y: number; z: number };
  readonly b: { x: number; y: number; z: number };
  readonly length: number;
  /** Its section (m). */
  readonly width: number;
  readonly depth: number;
}

export interface StructureWarning {
  readonly elementId: string;
  readonly kind: 'columnThin' | 'beamShallow' | 'beamUnsupported';
  readonly value: number;
}

/**
 * The analytic model: a column is a bar up its axis, a beam a bar along its axis at its middle height.
 * Warnings to look at with the engineer: a column narrower than 19 cm (NBR 6118's least, to confirm),
 * a beam shallower than a twelfth of its span (a common first sizing), a beam end with no column or
 * wall under it (30 cm).
 */
export function analyticModel(g: DerivedGeometry): { bars: Bar[]; warnings: StructureWarning[] } {
  const bars: Bar[] = [];
  const warnings: StructureWarning[] = [];
  const columns = [...((g.kinds.get('columns')?.values() ?? []) as Iterable<ColumnSolid>)];
  for (const s of columns) {
    const c = s.column;
    bars.push({ id: c.id, kind: 'column', a: { x: c.at.x, y: c.at.y, z: s.bottom }, b: { x: c.at.x, y: c.at.y, z: s.top }, length: s.top - s.bottom, width: c.width, depth: c.depth });
    if (Math.min(c.width, c.depth) < 0.19 - 1e-9) warnings.push({ elementId: c.id, kind: 'columnThin', value: Math.min(c.width, c.depth) });
  }
  const pieces = [...g.solids.values()].map((w) => ({ levelId: w.wall.levelId, top: w.top, rings: w.pieces.map((p) => p.polygon) }));
  for (const s of (g.kinds.get('beams')?.values() ?? []) as Iterable<BeamSolid>) {
    const b = s.beam;
    const z = (s.bottom + s.top) / 2;
    const span = Math.hypot(b.end.x - b.start.x, b.end.y - b.start.y);
    bars.push({ id: b.id, kind: 'beam', a: { x: b.start.x, y: b.start.y, z }, b: { x: b.end.x, y: b.end.y, z }, length: span, width: b.width, depth: b.depth });
    if (b.depth < span / 12 - 1e-9) warnings.push({ elementId: b.id, kind: 'beamShallow', value: span / 12 });
    // An end rests on a column near it, or on a wall under it.
    const rests = (p: Point2) =>
      columns.some((c) => Math.hypot(c.column.at.x - p.x, c.column.at.y - p.y) <= 0.3 && c.top >= s.bottom - 0.05) ||
      pieces.some((w) => Math.abs(w.top - s.bottom) <= 0.3 && w.rings.some((ring) => insideRing(ring, p) || toRing(p, ring) <= 0.05));
    if (!rests(b.start) || !rests(b.end)) warnings.push({ elementId: b.id, kind: 'beamUnsupported', value: span });
  }
  return { bars, warnings };
}

/** The wet rooms' waterproofing: each one's floor and its walls' strip (perimeter × the strip's height). */
export function waterproofing(doc: Doc, g: DerivedGeometry, strip = 0.3): { roomId: string; floor: number; walls: number }[] {
  const wet = new Set(['bathroom', 'service']);
  return doc.rooms
    .filter((r) => r.use && wet.has(r.use))
    .flatMap((r) => {
      const s = g.rooms.get(r.id);
      return s?.enclosed ? [{ roomId: r.id, floor: s.area, walls: s.perimeter * strip }] : [];
    });
}

/**
 * The runs (and their points) drawn isometric, as SVG: x across to the right and down, y to the right
 * and up, z straight up, 30° each; each run in its system's colour, the points as discs, a point's drop
 * to its run dashed; fitted to its box.
 */
export function isometricSvg(doc: Doc, runs: readonly MepRun[], width = 800, height = 520): string {
  const elevation = new Map(doc.levels.map((l) => [l.id, l.elevation]));
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  const proj = (x: number, y: number, z: number) => ({ u: (x - y) * cos, v: -(x + y) * sin - z });
  const lines = runs.map((r) => ({
    color: systemIn(doc, r.systemId)?.color ?? '#888888',
    width: r.diameter,
    pts: r.points.map((p) => proj(p.x, p.y, p.z + (elevation.get(r.levelId) ?? 0))),
  }));
  const ids = new Set(runs.map((r) => r.systemId));
  const dots = doc.mepPoints
    .filter((p) => ids.has(p.systemId))
    .map((p) => ({ color: systemIn(doc, p.systemId)?.color ?? '#888888', ...proj(p.at.x, p.at.y, p.height + (elevation.get(p.levelId) ?? 0)) }));
  // A point under (or over) a run's vertex joins it by a drop (network.ts): drawn too, or it floats.
  const drawn = new Set(runs.map((r) => r.id));
  const drops = [...networksOf(doc).values()].flatMap((net) =>
    net.edges
      .filter((e) => !e.runId && net.edges.some((x) => x.runId !== undefined && drawn.has(x.runId) && (x.a === e.a || x.b === e.a)))
      .map((e) => {
        const p = net.points.find((x) => x.id === net.nodes[e.b]!.pointId);
        const [a, b] = [net.nodes[e.a]!, net.nodes[e.b]!];
        return { color: (p && systemIn(doc, p.systemId)?.color) ?? '#888888', pts: [proj(a.x, a.y, a.z), proj(b.x, b.y, b.z)] };
      }),
  );
  const all = [...lines.flatMap((l) => l.pts), ...dots, ...drops.flatMap((d) => d.pts)];
  if (all.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
  const u0 = Math.min(...all.map((p) => p.u));
  const u1 = Math.max(...all.map((p) => p.u));
  const v0 = Math.min(...all.map((p) => p.v));
  const v1 = Math.max(...all.map((p) => p.v));
  const pad = 24;
  const k = Math.min((width - 2 * pad) / Math.max(u1 - u0, 1e-6), (height - 2 * pad) / Math.max(v1 - v0, 1e-6));
  const X = (u: number) => (pad + (u - u0) * k).toFixed(1);
  const Y = (v: number) => (pad + (v - v0) * k).toFixed(1);
  const paths = lines
    .map((l) => `<polyline fill="none" stroke="${l.color}" stroke-width="${Math.max(2, l.width * k).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" points="${l.pts.map((p) => `${X(p.u)},${Y(p.v)}`).join(' ')}"/>`)
    .join('');
  const dropLines = drops.map((d) => `<line stroke="${d.color}" stroke-width="1.5" stroke-dasharray="4 3" x1="${X(d.pts[0]!.u)}" y1="${Y(d.pts[0]!.v)}" x2="${X(d.pts[1]!.u)}" y2="${Y(d.pts[1]!.v)}"/>`).join('');
  const circles = dots.map((d) => `<circle cx="${X(d.u)}" cy="${Y(d.v)}" r="5" fill="${d.color}" stroke="#ffffff" stroke-width="1.5"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">${paths}${dropLines}${circles}</svg>`;
}
