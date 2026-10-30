// Roofs (ref/chat.txt:89, 136): drawn by their outline (the walls' line under them), each side with its
// slope (or none: a gable, an empena) and its overhang (beiral). The kinds are ways of setting the sides:
// flat (with a parapet, platibanda), one slope (uma água), two (duas águas), four (quatro águas).
// geometry.ts builds the faces.

import type { Point2 } from '../../model/vector';

export const ROOF_PREFIX = 'roof';
export type RoofKind = 'flat' | 'shed' | 'gable' | 'hip';

/** A side's slope in % (rise per run; null: a gable, no slope on that side) and its overhang (m). */
export interface RoofEdge {
  readonly grade: number | null;
  readonly overhang: number;
}

export interface Roof {
  readonly id: string;
  readonly levelId: string;
  /** Counter-clockwise; side i runs from point i to point i + 1. */
  readonly outline: readonly Point2[];
  readonly edges: readonly RoofEdge[];
  readonly kind: RoofKind;
  /** Of the roof's build-up, square to its slope (m). */
  readonly thickness: number;
  /** Its eaves above (+) or below (−) its level's top (m). */
  readonly baseOffset: number;
  /** A flat roof's parapet height above the roof (m); none without. */
  readonly parapet?: number;
  /** What it is covered with, for the envelope's thermal check (sim/envelope.ts): absent, a clay tile. */
  readonly covering?: RoofCovering;
}

/** A roof's covering: its material and thickness (m). */
export interface RoofCovering {
  readonly materialId: string;
  readonly thickness: number;
}

/** A roof's covering when it names none: clay tile, 1 cm (NBR 15220-3 table D.4's). */
export const ROOF_COVERING: RoofCovering = { materialId: 'clayTile', thickness: 0.01 };

/** A new roof's slope (%), overhang, thickness and a flat roof's parapet (m). */
export const ROOF_GRADE = 30;
export const ROOF_OVERHANG = 0.5;
export const ROOF_THICKNESS = 0.12;
export const ROOF_PARAPET = 0.8;

export const isRoofId = (id: string): boolean => id.startsWith(`${ROOF_PREFIX}_`);

/**
 * The sides a kind slopes, at `grade` %: flat, none; one slope, the longest side's (the roof falls to
 * it); two, the longest side and the one most opposite to it; four, every side.
 */
export function edgesFor(kind: RoofKind, outline: readonly Point2[], grade: number, overhang: number): RoofEdge[] {
  const n = outline.length;
  const dir = (i: number) => {
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l, l };
  };
  const longest = [...Array(n).keys()].reduce((m, i) => (dir(i).l > dir(m).l ? i : m), 0);
  const d0 = dir(longest);
  const opposite = [...Array(n).keys()].filter((i) => i !== longest).reduce((m, i) => (d0.x * dir(i).x + d0.y * dir(i).y < d0.x * dir(m).x + d0.y * dir(m).y ? i : m), (longest + 1) % n);
  const sloped = (i: number) => (kind === 'hip' ? true : kind === 'gable' ? i === longest || i === opposite : kind === 'shed' ? i === longest : false);
  return outline.map((_, i) => ({ grade: sloped(i) ? grade : null, overhang }));
}
