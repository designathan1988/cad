// Cut and fill (docs/plano-de-escopo.md, phase 11: "cortes e aterros"): under the lowest level's
// footprint (its enclosed rooms and its walls), the ground between the spot heights against that
// level's floor, its depth sampled on a 10 cm grid over the footprint's exact area: where the ground is
// above the floor it is cut, below it is filled. The floor's own build-up and the foundations are not
// counted: an estimate of the earth moved to make the platform. Pure.

import type { Doc } from '../../app/document';
import type { DerivedGeometry } from '../../app/geometry';
import type { Point2 } from '../../core/vector';
import { insideRing, signedArea } from '../room/derive';
import { heightAt } from './schema';

export interface Earthworks {
  /** m³ of ground over the floor taken away, and of ground under it brought in. */
  readonly cut: number;
  readonly fill: number;
  /** m²: the footprint they are measured under. */
  readonly area: number;
  /** The level they are measured against, and its floor's height. */
  readonly levelId: string;
  readonly floor: number;
}

/** The grid's cell (m). */
const CELL = 0.1;

export function earthworksOf(doc: Doc, g: DerivedGeometry): Earthworks | null {
  const spots = doc.terrains.flatMap((t) => t.spots);
  const lowest = [...doc.levels].sort((a, b) => a.elevation - b.elevation)[0];
  if (!lowest || spots.length === 0) return null;
  const rings: (readonly Point2[])[] = [
    ...[...g.rooms.values()].filter((r) => r.room.levelId === lowest.id && r.enclosed && r.outline.length >= 3).map((r) => r.outline),
    ...(g.levelPieces.get(lowest.id) ?? []),
  ];
  if (rings.length === 0) return null;
  const pts = rings.flat();
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y));
  const y1 = Math.max(...pts.map((p) => p.y));
  // The grid gives the depth over and under the floor where it is; the footprint's area is its rings'
  // exactly (the rooms inside the walls' faces, the walls' pieces round them, not overlapping), so the
  // cells along its edges do not count too much or too little of it.
  let over = 0;
  let under = 0;
  let n = 0;
  for (let x = x0 + CELL / 2; x < x1; x += CELL)
    for (let y = y0 + CELL / 2; y < y1; y += CELL) {
      const p = { x, y };
      if (!rings.some((r) => insideRing(r, p))) continue;
      n++;
      const d = heightAt(spots, p) - lowest.elevation;
      if (d > 0) over += d;
      else under -= d;
    }
  if (n === 0) return null;
  const area = rings.reduce((s, r) => s + Math.abs(signedArea(r)), 0);
  return { cut: (over / n) * area, fill: (under / n) * area, area, levelId: lowest.id, floor: lowest.elevation };
}
