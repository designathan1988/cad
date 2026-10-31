// A wall's pieces between its notches, and the join warnings kept once each.

import type { EndCut, JoinWarning, Notch } from '../join/types';
import type { WallShape } from './shape';
import type { StemSplit } from './arc-joints';
import type { Piece } from './footprint';
import { strip } from './offset';
import { clipHalfPlane, clipOut } from './convex';

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
