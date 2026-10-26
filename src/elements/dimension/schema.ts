// Permanent dimensions (ref/chat.txt:117, "cotas permanentes associadas aos elementos"): a distance between
// two points, drawn off their line, kept with the project. Each point is held by what it was put on: a
// wall (an end, a distance along it, a distance across it: its faces and corners), a door's or a window's
// jamb, or nothing (a point in the plan). Moving, stretching or thickening the wall moves the point.

import type { Point2 } from '../../core/vector';

export const DIM_PREFIX = 'dim';

/**
 * Where an end of a dimension is held. On a wall: from its start or its end, `along` metres into it along
 * its chord (negative past the end: the corner of a face that reaches beyond the reference line) and
 * `offset` metres across, along its normal (the left of start → end), as its faces are. On a door or a
 * window: one of its jambs, `offset` across its wall.
 */
export type DimAnchor =
  | { readonly kind: 'wall'; readonly wallId: string; readonly end: 'start' | 'end'; readonly along: number; readonly offset: number }
  | { readonly kind: 'opening'; readonly openingId: string; readonly jamb: 'start' | 'end'; readonly offset: number }
  | { readonly kind: 'point'; readonly at: Point2 };

export interface Dimension {
  readonly id: string;
  readonly levelId: string;
  readonly a: DimAnchor;
  readonly b: DimAnchor;
  /** The dimension line's distance from the line a → b (m), to its left (negative: its right). */
  readonly offset: number;
}

export const isDimId = (id: string): boolean => id.startsWith(`${DIM_PREFIX}_`);

/** The element an end is held by, or null for a point. */
export const anchorElement = (a: DimAnchor): string | null => (a.kind === 'wall' ? a.wallId : a.kind === 'opening' ? a.openingId : null);
