// Beams (ref/chat.txt:86, 134): a bar between two points of a level, hanging from the level's top
// (plus an adjustment), its width across and its depth down. Above the plan's cut, so drawn dashed in
// plan, as hidden lines are; solid in 3D. It goes with the grid axis it lies on (elements/grid/carry.ts).

import { add, normalize, perp, type Point2, scale, sub } from '../../core/vector';

export const BEAM_PREFIX = 'beam';
/** A new beam's section (m): 15 cm wide, 40 cm deep. */
export const BEAM_WIDTH = 0.15;
export const BEAM_DEPTH = 0.4;

export interface Beam {
  readonly id: string;
  readonly levelId: string;
  /** Its axis, at its middle across. */
  readonly start: Point2;
  readonly end: Point2;
  readonly width: number;
  /** Down from its top (m). */
  readonly depth: number;
  /** Its top above (+) or below (−) its level's top (m). */
  readonly topOffset?: number;
  /** Its top at its end, when it slopes: above (+) or below (−) its level's top (m); its start's when not set. */
  readonly endOffset?: number;
  /** Its section: a rectangle (when not set) or an I, its flanges `plate` thick. */
  readonly shape?: 'rect' | 'I';
  readonly plate?: number;
}

/** An I beam's plates when it sets none (m). */
export const BEAM_PLATE = 0.012;

/**
 * Its section, across its width (a, from its axis) and down from its top (u ≤ 0), counter-clockwise
 * seen from its start: a rectangle, or an I with its flanges at its top and bottom.
 */
export function beamSection(b: Beam): [number, number][] {
  const hw = b.width / 2;
  const d = b.depth;
  if (b.shape !== 'I') return [[-hw, -d], [hw, -d], [hw, 0], [-hw, 0]];
  const t = Math.min(b.plate ?? BEAM_PLATE, b.width / 3, d / 3);
  const h = t / 2;
  return [[-hw, -d], [hw, -d], [hw, -d + t], [h, -d + t], [h, -t], [hw, -t], [hw, 0], [-hw, 0], [-hw, -t], [-h, -t], [-h, -d + t], [-hw, -d + t]];
}

export const isBeamId = (id: string): boolean => id.startsWith(`${BEAM_PREFIX}_`);

/** Its outline in plan: its width either side of its axis, counter-clockwise. */
export function beamOutline(b: Beam): Point2[] {
  const n = scale(perp(normalize(sub(b.end, b.start))), b.width / 2);
  return [sub(b.start, n), sub(b.end, n), add(b.end, n), add(b.start, n)];
}
