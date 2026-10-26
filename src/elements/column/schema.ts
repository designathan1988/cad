// Columns (ref/chat.txt:86, 134): a rectangle in plan standing from its level's floor to the level's
// ceiling (plus an adjustment), turned by an angle. Placed at a point (a grid crossing, a corner), it goes
// with the grid axes it stands on (elements/grid/carry.ts). Drawn cut in plan, solid in 3D.

import { add, type Point2, scale } from '../../core/vector';

export const COLUMN_PREFIX = 'column';
/** A new column's section (m): 25 × 25 cm. */
export const COLUMN_SIZE = 0.25;

export interface Column {
  readonly id: string;
  readonly levelId: string;
  /** Its centre. */
  readonly at: Point2;
  /** Along its own x (turned by `angle`) and its own y (m). */
  readonly width: number;
  readonly depth: number;
  /** Radians, counter-clockwise from the plan's x. */
  readonly angle: number;
  /** Above (+) or below (−) its level's top (m). */
  readonly topOffset?: number;
}

export const isColumnId = (id: string): boolean => id.startsWith(`${COLUMN_PREFIX}_`);

/** Its section in plan, counter-clockwise. */
export function columnOutline(c: Column): Point2[] {
  const u = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  const v = { x: -u.y, y: u.x };
  const hw = c.width / 2;
  const hd = c.depth / 2;
  return [
    add(c.at, add(scale(u, -hw), scale(v, -hd))),
    add(c.at, add(scale(u, hw), scale(v, -hd))),
    add(c.at, add(scale(u, hw), scale(v, hd))),
    add(c.at, add(scale(u, -hw), scale(v, hd))),
  ];
}
