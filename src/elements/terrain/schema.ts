// The terrain (docs/plano-de-escopo.md, phase 11: "terreno"): the lot's outline and spot heights in it,
// the ground between them interpolated (inverse distance), drawn in plan with its contour lines and in
// 3D as a surface. Heights above the project's zero (m), as the levels' elevations.

import type { Point2 } from '../../core/vector';

export const TERRAIN_PREFIX = 'terrain';

export interface SpotHeight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Terrain {
  readonly id: string;
  /** The level it is drawn on (the ground floor's). */
  readonly levelId: string;
  /** Its outline, counter-clockwise. */
  readonly outline: readonly Point2[];
  readonly spots: readonly SpotHeight[];
  /** The contour lines' interval (m). */
  readonly interval: number;
}

export const DEFAULT_INTERVAL = 0.5;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p: unknown): p is Point2 => typeof p === 'object' && p !== null && finite((p as Point2).x) && finite((p as Point2).y);

export const isTerrain = (x: unknown): x is Terrain => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.levelId === 'string' &&
    Array.isArray(o.outline) &&
    o.outline.length >= 3 &&
    o.outline.every(isPoint) &&
    Array.isArray(o.spots) &&
    o.spots.every((s) => isPoint(s) && finite((s as SpotHeight).z)) &&
    finite(o.interval) &&
    (o.interval as number) >= 0.05
  );
};

/** The ground's height at p: the spots' heights weighted by the inverse square of their distance; a spot's own there; 0 with none. */
export function heightAt(spots: readonly SpotHeight[], p: Point2): number {
  if (spots.length === 0) return 0;
  let sw = 0;
  let sz = 0;
  for (const s of spots) {
    const d2 = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
    if (d2 < 1e-12) return s.z;
    const w = 1 / d2;
    sw += w;
    sz += w * s.z;
  }
  return sz / sw;
}
