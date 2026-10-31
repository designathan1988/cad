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
import type { DerivedGeometry } from '../../project/derive';
import { hideCategories } from '../../project/derived-filters';
import { type Point2, sub } from '../../model/vector';
import type { Point3 } from '../../model/section-box';
import { eachSolid } from '../registry';
import type { KindSolid } from '../contract';
import { openingParts } from '../opening/parts';
import { insideRing, type RoomSolid } from '../room/derive';
import { lookOf, type SectionMark } from './schema';
import type { CutPattern } from '../material/schema';
import { clipRing, clipSegment, featureEdges, loopsOf, outlineOf, type Ring, type V } from './edges';

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
      // A loop, not a spread: a cut of many segments passed as arguments overflows the engine (RangeError).
      const at = outline.flat().reduce((x, p) => Math.max(x, p.x), openings.get(id)?.at ?? -Infinity);
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
      ? cutPoints.reduce(
          (b, p) => ({ min: { x: Math.min(b.min.x, p.x), y: Math.min(b.min.y, p.y) }, max: { x: Math.max(b.max.x, p.x), y: Math.max(b.max.y, p.y) } }),
          { min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } },
        )
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
