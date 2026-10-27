// The table of areas (quadro de áreas) and the lot's measures, from the model: what each level covers
// (its walls before their doors and windows are cut, and its rooms, their union's outer outline), the
// building's projection on the lot (the union of every level's), the built area, and from them the
// occupancy, the floor-area ratio, the permeable share, the setbacks from the lot's sides and the
// height. The lot's outline is the terrain's (elements/terrain), or only its area when the lot gives
// one. The permeable share is the lot less the projection and the floors outside it (a patio, a
// driveway: a floor drawn by its outline out of doors), each counted once where they overlap.
// Pure.

import { setPrecision, union } from 'polyclip-ts';
import { dot, type Point2, sub } from '../core/vector';
import { KINDS } from '../elements/registry';
import { type FloorSolid, signedArea } from '../elements/room/derive';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';
import { lotOf } from './lot';

// Wall pieces meet to the last bits of a float: the same tolerance as the rooms' union (room/derive.ts).
setPrecision(1e-9);

type Ring = [number, number][];
const toRing = (poly: readonly Point2[]): Ring => poly.map((p) => [p.x, p.y]);
const fromRing = (r: Ring): Point2[] => {
  const pts = r.map(([x, y]) => ({ x, y }));
  const last = pts[pts.length - 1];
  if (last && pts.length > 1 && last.x === pts[0]!.x && last.y === pts[0]!.y) pts.pop();
  return pts;
};

/** The outer outlines of the union of these polygons, their holes filled (a courtyard is built around). */
export function coverOf(polys: readonly (readonly Point2[])[]): Point2[][] {
  const good = polys.filter((p) => p.length >= 3);
  if (good.length === 0) return [];
  const [first, ...rest] = good.map((p) => [toRing(p)]);
  return union(first!, ...rest).map((poly) => fromRing(poly[0]!));
}

const areaOf = (rings: readonly (readonly Point2[])[]) => rings.reduce((s, r) => s + Math.abs(signedArea(r)), 0);

/** The least distance from p to the segment ab. */
function toSegment(p: Point2, a: Point2, b: Point2): number {
  const d = sub(b, a);
  const k = Math.max(0, Math.min(1, dot(sub(p, a), d) / Math.max(dot(d, d), 1e-18)));
  return Math.hypot(p.x - (a.x + d.x * k), p.y - (a.y + d.y * k));
}

/** The least distance between an outline and a segment (they do not cross). */
function outlineToSegment(ring: readonly Point2[], a: Point2, b: Point2): number {
  let least = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    least = Math.min(least, toSegment(p, a, b), toSegment(a, p, q), toSegment(b, p, q));
  }
  return least;
}

export interface LevelArea {
  readonly levelId: string;
  /** What the level covers (m²). */
  readonly built: number;
}

export interface LotReport {
  /** The lot's area (m²): its outline's, else the area entered; null when neither. */
  readonly lotArea: number | null;
  /** The lot's outline, when a terrain gives it. */
  readonly outline: readonly Point2[] | null;
  readonly levels: readonly LevelArea[];
  readonly built: number;
  /** The building's projection on the lot (m²) and its outline. */
  readonly projection: number;
  readonly cover: readonly (readonly Point2[])[];
  /** %, the ratio, % (null without the lot's area). */
  readonly occupancy: number | null;
  readonly floorRatio: number | null;
  readonly permeability: number | null;
  /** m²: the floors outside the building's projection on the ground level (paving), counted against the permeable share. */
  readonly paving: number;
  /** Least distances to the front, the sides and the back (m; null without an outline or a building). */
  readonly setbacks: { readonly front: number | null; readonly side: number | null; readonly back: number | null };
  /** From the lowest level's floor to the highest top of a wall or of another solid (m). */
  readonly height: number;
}

export function lotReport(doc: Doc, g: DerivedGeometry): LotReport {
  const lot = lotOf(doc);
  const outline = doc.terrains[0]?.outline ?? null;
  const lotArea = outline ? Math.abs(signedArea(outline)) : (lot.area ?? null);
  const levels: LevelArea[] = [];
  const covers: Point2[][] = [];
  for (const level of doc.levels) {
    const rooms = [...g.rooms.values()].filter((r) => r.room.levelId === level.id && r.enclosed).map((r) => r.outline);
    const cover = coverOf([...(g.levelPieces.get(level.id) ?? []), ...rooms]);
    if (cover.length === 0) continue;
    levels.push({ levelId: level.id, built: areaOf(cover) });
    covers.push(...cover);
  }
  const cover = coverOf(covers);
  const projection = areaOf(cover);
  const built = levels.reduce((s, l) => s + l.built, 0);
  const ratio = (v: number) => (lotArea && lotArea > 0 ? v / lotArea : null);
  // The sides: the front one chosen, the back the one farthest from it, the others its sides.
  const setbacks = { front: null as number | null, side: null as number | null, back: null as number | null };
  if (outline && outline.length >= 3 && cover.length > 0) {
    const n = outline.length;
    const edge = (i: number) => [outline[i % n]!, outline[(i + 1) % n]!] as const;
    const front = Math.min(lot.frontEdge, n - 1);
    const [fa, fb] = edge(front);
    const mid = (i: number) => {
      const [a, b] = edge(i);
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    let back = -1;
    let far = -1;
    for (let i = 0; i < n; i++) {
      if (i === front) continue;
      const d = toSegment(mid(i), fa, fb);
      if (d > far) (far = d), (back = i);
    }
    const least = (i: number) => Math.min(...cover.map((r) => outlineToSegment(r, ...edge(i))));
    setbacks.front = least(front);
    setbacks.back = back >= 0 ? least(back) : null;
    const sides = [...Array(n).keys()].filter((i) => i !== front && i !== back);
    setbacks.side = sides.length > 0 ? Math.min(...sides.map(least)) : null;
  }
  const ground = Math.min(...doc.levels.map((l) => l.elevation));
  let top = ground;
  for (const s of g.solids.values()) top = Math.max(top, s.top);
  // Roofs, stairs, columns…: each kind's own height range (elements/contract.ts span); the ground not.
  for (const k of KINDS) {
    if (!k.span || k.key === 'terrains') continue;
    for (const s of g.kinds.get(k.key)?.values() ?? []) top = Math.max(top, k.span(s as never).top);
  }
  const occ = ratio(projection);
  // What does not let the rain in: the building's projection and the floors on the ground's level drawn
  // outside it (no ceiling), together (a floor under the building is in the projection already).
  const bottom = doc.levels.length > 0 ? [...doc.levels].sort((a, b) => a.elevation - b.elevation)[0]!.id : null;
  const floors = [...((g.kinds.get('floors')?.values() ?? []) as Iterable<FloorSolid>)].filter((f) => f.floor.kind !== 'ceiling' && f.floor.levelId === bottom).map((f) => f.outline);
  const sealed = floors.length > 0 ? areaOf(coverOf([...cover, ...floors])) : projection;
  const shut = ratio(sealed);
  return {
    lotArea,
    outline,
    levels,
    built,
    projection,
    cover,
    occupancy: occ === null ? null : occ * 100,
    floorRatio: ratio(built),
    permeability: shut === null ? null : (1 - shut) * 100,
    paving: sealed - projection,
    setbacks,
    height: top - ground,
  };
}
