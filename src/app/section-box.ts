// The section box (Revit's Section Box, Vectorworks' Clip Cube): the 3D view keeps only what is inside
// a box, each of its six faces dragged by a handle at its middle. Plan coordinates and heights, as the
// model's; interface state, kept with the 3D view's other choices (view-3d.ts). Pure.

import type { Point2 } from '../model/vector';
import { clipHalfPlane } from '../elements/wall/geometry/convex';

export interface Point3 {
  readonly x: number;
  readonly y: number;
  /** Height. */
  readonly z: number;
}

export interface SectionBox {
  readonly min: Point3;
  readonly max: Point3;
}

/** A face: the axis it is square to, and which end of the box. */
export type BoxFace = 'x-' | 'x+' | 'y-' | 'y+' | 'z-' | 'z+';
export const BOX_FACES: readonly BoxFace[] = ['x-', 'x+', 'y-', 'y+', 'z-', 'z+'];

/** The box never gets thinner than this (m): a face dragged past the other stops short of it. */
export const MIN_BOX = 0.1;
/** Around the model when the box is first shown (m). */
export const BOX_MARGIN = 0.5;

const axisOf = (f: BoxFace): 'x' | 'y' | 'z' => f[0] as 'x' | 'y' | 'z';

/** The middle of a face. */
export function faceCenter(b: SectionBox, f: BoxFace): Point3 {
  const mid = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2, z: (b.min.z + b.max.z) / 2 };
  const a = axisOf(f);
  return { ...mid, [a]: f[1] === '-' ? b.min[a] : b.max[a] };
}

/** The outward direction of a face. */
export function faceNormal(f: BoxFace): Point3 {
  const s = f[1] === '-' ? -1 : 1;
  const a = axisOf(f);
  return { x: a === 'x' ? s : 0, y: a === 'y' ? s : 0, z: a === 'z' ? s : 0 };
}

/** The box with one face moved out by `d` (m; in when negative), never past the other face. */
export function moveFace(b: SectionBox, f: BoxFace, d: number): SectionBox {
  const a = axisOf(f);
  if (f[1] === '+') return { ...b, max: { ...b.max, [a]: Math.max(b.max[a] + d, b.min[a] + MIN_BOX) } };
  return { ...b, min: { ...b.min, [a]: Math.min(b.min[a] - d, b.max[a] - MIN_BOX) } };
}

/** The box first shown: around the model's plan bounds and heights, with a margin. */
export function boxAround(bounds: { min: Point2; max: Point2 } | null, bottom: number, top: number): SectionBox {
  const b = bounds ?? { min: { x: -1, y: -1 }, max: { x: 9, y: 7 } };
  return {
    min: { x: b.min.x - BOX_MARGIN, y: b.min.y - BOX_MARGIN, z: bottom - BOX_MARGIN },
    max: { x: b.max.x + BOX_MARGIN, y: b.max.y + BOX_MARGIN, z: top + BOX_MARGIN },
  };
}

/** The twelve edges of the box, for drawing it. */
export function boxEdges(b: SectionBox): [Point3, Point3][] {
  const c = (i: number): Point3 => ({ x: i & 1 ? b.max.x : b.min.x, y: i & 2 ? b.max.y : b.min.y, z: i & 4 ? b.max.z : b.min.z });
  const edges: [Point3, Point3][] = [];
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) edges.push([c(i), c(i | bit)]);
  return edges;
}

/**
 * How far along a face's normal a pointer moved (m): its move on screen, along where the normal
 * points on screen (`along`: pixels the face's middle moves for 1 m out).
 */
export function dragDistance(moved: Point2, along: Point2): number {
  const len2 = along.x * along.x + along.y * along.y;
  if (len2 < 1e-6) return 0;
  return (moved.x * along.x + moved.y * along.y) / len2;
}

/** A stored box, or null for anything that is not one. */
export function readBox(raw: unknown): SectionBox | null {
  const ok = (p: unknown): p is Point3 =>
    typeof p === 'object' && p !== null && ['x', 'y', 'z'].every((k) => Number.isFinite((p as Record<string, unknown>)[k]));
  if (typeof raw !== 'object' || raw === null) return null;
  const { min, max } = raw as Record<string, unknown>;
  if (!ok(min) || !ok(max) || min.x >= max.x || min.y >= max.y || min.z >= max.z) return null;
  return { min: { x: min.x, y: min.y, z: min.z }, max: { x: max.x, y: max.y, z: max.z } };
}

/** A prism standing up: an outline in plan between two heights (a wall's block, a floor). */
export interface UprightPrism {
  readonly polygon: readonly Point2[];
  readonly bottom: number;
  readonly top: number;
  /** A top that follows a plane, z = a·x + b·y + c (a wall under a roof), `top` its highest. */
  readonly plane?: { readonly a: number; readonly b: number; readonly c: number };
}

/** The prism's top over q: its plane's height there, kept between its bottom and top. */
const topAt = (p: UprightPrism, q: Point2): number => (p.plane ? Math.max(p.bottom, Math.min(p.top, p.plane.a * q.x + p.plane.b * q.y + p.plane.c)) : p.top);

/**
 * Where the box's faces go through the prisms, as flat polygons to fill (Revit fills them as the plan
 * fills a cut wall): on a side face, a rectangle for each stretch of the outline the face's line
 * crosses; on the top or the bottom face, the outline itself. Each one on its face; what lies past
 * the box's other faces is left for the clipping to take.
 */
export function boxCaps(prisms: readonly UprightPrism[], box: SectionBox): Point3[][] {
  const caps: Point3[][] = [];
  for (const p of prisms) {
    const z0 = Math.max(p.bottom, box.min.z);
    const z1 = Math.min(p.top, box.max.z);
    if (z1 - z0 > 1e-9) {
      for (const [axis, c] of [
        ['x', box.min.x],
        ['x', box.max.x],
        ['y', box.min.y],
        ['y', box.max.y],
      ] as const) {
        for (const [a, b] of crossings(p.polygon, axis, c)) {
          const at = (s: number, z: number): Point3 => (axis === 'x' ? { x: c, y: s, z } : { x: s, y: c, z });
          // Under a slope, the cap's top follows it.
          const up = (s: number) => Math.max(z0, Math.min(z1, topAt(p, at(s, 0))));
          caps.push([at(a, z0), at(b, z0), at(b, up(b)), at(a, up(a))]);
        }
      }
    }
    for (const z of [box.min.z, box.max.z]) {
      if (!(z > p.bottom && z < p.top)) continue;
      // Under a slope, only where the slope is above the box's face.
      const poly = p.plane ? clipHalfPlane(p.polygon, { normal: { x: -p.plane.a, y: -p.plane.b }, offset: p.plane.c - z }) : p.polygon;
      if (poly.length >= 3) caps.push(poly.map((q) => ({ x: q.x, y: q.y, z })));
    }
  }
  return caps;
}

/** The stretches of the line `axis` = c inside a simple polygon, along the other axis, in order. */
function crossings(poly: readonly Point2[], axis: 'x' | 'y', c: number): [number, number][] {
  const other = axis === 'x' ? 'y' : 'x';
  const at: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    // Half-open, so a vertex on the line counts once.
    if ((a[axis] <= c) !== (b[axis] <= c)) at.push(a[other] + ((c - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other]));
  }
  at.sort((u, v) => u - v);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < at.length; i += 2) if (at[i + 1]! - at[i]! > 1e-9) out.push([at[i]!, at[i + 1]!]);
  return out;
}

/**
 * A vertical section (Revit's Section): the vertical plane through a line in plan, keeping what lies on
 * its left (looking along `dir`), seen square from its right. Made from a guide (app.ts).
 */
export interface SectionLine {
  readonly point: Point2;
  /** Unit direction; what is kept is on its left. */
  readonly dir: Point2;
}

/** The kept side's direction, square to the line: where the section looks. */
export const sectionLooks = (s: SectionLine): Point2 => ({ x: -s.dir.y, y: s.dir.x });

/** Where the section's plane goes through the prisms: a rectangle for each stretch of outline it crosses. */
export function sectionCaps(prisms: readonly UprightPrism[], s: SectionLine): Point3[][] {
  const n = sectionLooks(s);
  const caps: Point3[][] = [];
  for (const p of prisms) {
    const poly = p.polygon;
    const at: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const da = (a.x - s.point.x) * n.x + (a.y - s.point.y) * n.y;
      const db = (b.x - s.point.x) * n.x + (b.y - s.point.y) * n.y;
      if (da <= 0 !== db <= 0) {
        const k = da / (da - db);
        at.push((a.x + (b.x - a.x) * k - s.point.x) * s.dir.x + (a.y + (b.y - a.y) * k - s.point.y) * s.dir.y);
      }
    }
    at.sort((u, v) => u - v);
    const on = (t: number, z: number): Point3 => ({ x: s.point.x + s.dir.x * t, y: s.point.y + s.dir.y * t, z });
    for (let i = 0; i + 1 < at.length; i += 2) {
      if (at[i + 1]! - at[i]! > 1e-9) caps.push([on(at[i]!, p.bottom), on(at[i + 1]!, p.bottom), on(at[i + 1]!, topAt(p, on(at[i + 1]!, 0))), on(at[i]!, topAt(p, on(at[i]!, 0)))]);
    }
  }
  return caps;
}

/** A stored section, or null for anything that is not one. */
export function readSection(raw: unknown): SectionLine | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { point, dir } = raw as Record<string, Record<string, unknown> | undefined>;
  const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!point || !dir || !fin(point.x) || !fin(point.y) || !fin(dir.x) || !fin(dir.y)) return null;
  const len = Math.hypot(dir.x, dir.y);
  if (len < 1e-9) return null;
  return { point: { x: point.x, y: point.y }, dir: { x: dir.x / len, y: dir.y / len } };
}
