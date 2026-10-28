// Columns (ref/chat.txt:86, 134): a rectangle in plan standing from its level's floor to the level's
// ceiling (plus an adjustment), turned by an angle. Placed at a point (a grid crossing, a corner). Drawn
// cut in plan, solid in 3D.

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
  /** Above (+) or below (−) its level's top, or the top level's floor (m). */
  readonly topOffset?: number;
  /** Its section: a rectangle (when not set), round (an ellipse in width × depth), an I or an H
   * (flanges across its width, or along its depth) or an L (an angle): plates `plate` thick. */
  readonly shape?: ColumnShape;
  readonly plate?: number;
  /** Up to another level's floor (plus its offset); its own level's top when not set. */
  readonly topLevelId?: string;
}

export type ColumnShape = 'rect' | 'round' | 'I' | 'H' | 'L';
export const COLUMN_SHAPES: readonly ColumnShape[] = ['rect', 'round', 'I', 'H', 'L'];
/** A steel profile's plates when it sets none (m). */
export const COLUMN_PLATE = 0.015;

export const isColumnId = (id: string): boolean => id.startsWith(`${COLUMN_PREFIX}_`);

/** Its section in plan, counter-clockwise: a rectangle, an ellipse in 32 sides, or a profile. */
export function columnOutline(c: Column): Point2[] {
  const u = { x: Math.cos(c.angle), y: Math.sin(c.angle) };
  const v = { x: -u.y, y: u.x };
  const hw = c.width / 2;
  const hd = c.depth / 2;
  // In its own axes (x along its width, y along its depth), from its centre.
  const at = ([x, y]: readonly [number, number]) => add(c.at, add(scale(u, x), scale(v, y)));
  // A plate never more than a third of the section, so the profile keeps its shape.
  const t = Math.min(c.plate ?? COLUMN_PLATE, c.width / 3, c.depth / 3);
  const h = t / 2;
  switch (c.shape ?? 'rect') {
    case 'round':
      return Array.from({ length: 32 }, (_, i) => at([hw * Math.cos((i * Math.PI) / 16), hd * Math.sin((i * Math.PI) / 16)]));
    case 'I':
      // Flanges across its width at its two ends in depth, the web between them.
      return [[-hw, -hd], [hw, -hd], [hw, -hd + t], [h, -hd + t], [h, hd - t], [hw, hd - t], [hw, hd], [-hw, hd], [-hw, hd - t], [-h, hd - t], [-h, -hd + t], [-hw, -hd + t]].map((p) => at(p as [number, number]));
    case 'H':
      // Flanges along its depth at its two ends in width, the web between them.
      return [[-hw, -hd], [-hw + t, -hd], [-hw + t, -h], [hw - t, -h], [hw - t, -hd], [hw, -hd], [hw, hd], [hw - t, hd], [hw - t, h], [-hw + t, h], [-hw + t, hd], [-hw, hd]].map((p) => at(p as [number, number]));
    case 'L':
      // One leg along its width, the other along its depth, meeting at its (−x, −y) corner.
      return [[-hw, -hd], [hw, -hd], [hw, -hd + t], [-hw + t, -hd + t], [-hw + t, hd], [-hw, hd]].map((p) => at(p as [number, number]));
    default:
      return [at([-hw, -hd]), at([hw, -hd]), at([hw, hd]), at([-hw, hd])];
  }
}
