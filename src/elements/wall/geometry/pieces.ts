// A wall's pieces between its notches, the straight walls' last overlap guard, and the join warnings kept once each.

import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { WallShape } from './shape';
import type { StemSplit } from './arc-joints';
import type { Piece } from './footprint';
import type { Wall, WallId } from '../schema';
import { strip } from './offset';
import { clipHalfPlane, clipOut, overlapArea } from './convex';
import { segmentDistance, type Point2 } from '../../../model/vector';
import { POINT_TOLERANCE } from '../../../model/tolerance';

/** Less than a square centimetre in common: the rounding of joined pieces, not an overlap. */
const OVERLAP_AREA = 1e-4;

/** Whether two segments touch or cross (within the tolerance), from the four ends' distances or a crossing. */
function touching(a0: Point2, a1: Point2, b0: Point2, b1: Point2): boolean {
  const side = (p: Point2, q: Point2, r: Point2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const crossing = side(a0, a1, b0) * side(a0, a1, b1) < 0 && side(b0, b1, a0) * side(b0, b1, a1) < 0;
  return crossing || Math.min(segmentDistance(a0, b0, b1), segmentDistance(a1, b0, b1), segmentDistance(b0, a0, a1), segmentDistance(b1, a0, a1)) <= POINT_TOLERANCE;
}

/**
 * The last guard for straight walls (an arc's are overlapsWithArcs'): two whose reference lines do not touch,
 * so no join was made between them, must not lie over each other. A slanted wall stopped a few millimetres
 * short of a thick one, one corner of its body in the other's, went unreported. Once per pair.
 */
export function overlapsUnjoined(pieces: ReadonlyMap<WallId, readonly Piece[]>, walls: readonly Wall[], already: readonly JoinWarning[]): JoinWarning[] {
  const straight = walls.filter((w) => !w.bulge);
  const boxes = new Map(straight.map((w) => {
    const pts = (pieces.get(w.id) ?? []).flatMap((p) => p.polygon);
    return [w.id, { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) }];
  }));
  const out: JoinWarning[] = [];
  for (let i = 0; i < straight.length; i++) {
    for (let j = i + 1; j < straight.length; j++) {
      const a = straight[i]!;
      const b = straight[j]!;
      const ba = boxes.get(a.id)!;
      const bb = boxes.get(b.id)!;
      if (ba.x1 < bb.x0 || bb.x1 < ba.x0 || ba.y1 < bb.y0 || bb.y1 < ba.y0) continue;
      if (touching(a.start, a.end, b.start, b.end) || already.some((w) => w.walls.includes(a.id) && w.walls.includes(b.id))) continue;
      const theirs = pieces.get(b.id) ?? [];
      if ((pieces.get(a.id) ?? []).some((p) => theirs.some((q) => overlapArea(p.polygon, q.polygon) > OVERLAP_AREA))) out.push({ kind: 'wallsOverlap', walls: [a.id, b.id] });
    }
  }
  return out;
}

export function dedupe(ws: readonly JoinWarning[]): JoinWarning[] {
  const seen = new Set<string>();
  return ws.filter((w) => {
    const k = `${w.kind}:${w.walls.join(',')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface Span {
  readonly shape: WallShape;
  readonly atStart: EndCut | undefined;
  readonly atEnd: EndCut | undefined;
  /** Its ends against an arc it does not go through (an X with the arc passing): split per wedge. */
  readonly splits?: readonly StemSplit[];
}

export function spanPieces({ shape, atStart, atEnd }: Span, notches: readonly Notch[]): Piece[] {
  const out: Piece[] = [];
  shape.layers.forEach((_, layerIndex) => {
    const cuts = [atStart, atEnd].flatMap((c) => (c ? [...c.cuts, ...(c.layerCuts?.[layerIndex] ?? [])] : []));
    const band = [shape.layerOffsets[layerIndex]!, shape.layerOffsets[layerIndex + 1]!] as const;
    let polygon = strip(shape, atStart?.extension ?? 0, atEnd?.extension ?? 0, band);
    for (const cut of cuts) polygon = clipHalfPlane(polygon, cut);
    let parts = polygon.length > 0 ? [polygon] : [];
    for (const n of notches) {
      if (layerIndex >= n.layers[0] && layerIndex <= n.layers[1]) parts = parts.flatMap((p) => clipOut(p, n.region));
    }
    for (const part of parts) out.push({ layerIndex, polygon: part });
  });
  return out;
}
