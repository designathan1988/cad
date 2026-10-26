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
}

export const isBeamId = (id: string): boolean => id.startsWith(`${BEAM_PREFIX}_`);

/** Its outline in plan: its width either side of its axis, counter-clockwise. */
export function beamOutline(b: Beam): Point2[] {
  const n = scale(perp(normalize(sub(b.end, b.start))), b.width / 2);
  return [sub(b.start, n), sub(b.end, n), add(b.end, n), add(b.start, n)];
}
