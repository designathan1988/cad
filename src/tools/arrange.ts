// Align and distribute any selection (phase 9; Figma's and Revit's): each element by the box around it
// in plan. Aligned to the selection's own box: its left, centre or right side, its bottom, middle or
// top; distributed across or up with equal gaps between the boxes, the first and the last staying
// where they are. Here only the steps each box takes; the app moves each element by its own.

import type { Point2 } from '../model/vector';

export type ArrangeHow = 'left' | 'centerX' | 'right' | 'bottom' | 'centerY' | 'top' | 'spreadX' | 'spreadY';
export const ARRANGE_HOWS: readonly ArrangeHow[] = ['left', 'centerX', 'right', 'bottom', 'centerY', 'top', 'spreadX', 'spreadY'];

export interface Box {
  readonly min: Point2;
  readonly max: Point2;
}

/** The box around points; null for none. */
export function boxOf(points: readonly Point2[]): Box | null {
  if (points.length === 0) return null;
  // A loop: spread as arguments, a large selection's points passed the engine's limit (a RangeError).
  let min = { x: Infinity, y: Infinity };
  let max = { x: -Infinity, y: -Infinity };
  for (const p of points) {
    min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y) };
    max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y) };
  }
  return { min, max };
}

/** How many boxes it takes: two to align, three to distribute (two have nothing between them). */
export const arrangeNeeds = (how: ArrangeHow): number => (how === 'spreadX' || how === 'spreadY' ? 3 : 2);

/** The step each box takes, in their order; all zero when there are too few. */
export function arrangeSteps(boxes: readonly Box[], how: ArrangeHow): Point2[] {
  const none = boxes.map(() => ({ x: 0, y: 0 }));
  if (boxes.length < arrangeNeeds(how)) return none;
  const all = boxOf(boxes.flatMap((b) => [b.min, b.max]))!;
  const mid = (b: Box, axis: 'x' | 'y') => (b.min[axis] + b.max[axis]) / 2;
  switch (how) {
    case 'left':
      return boxes.map((b) => ({ x: all.min.x - b.min.x, y: 0 }));
    case 'right':
      return boxes.map((b) => ({ x: all.max.x - b.max.x, y: 0 }));
    case 'centerX':
      return boxes.map((b) => ({ x: mid(all, 'x') - mid(b, 'x'), y: 0 }));
    case 'bottom':
      return boxes.map((b) => ({ x: 0, y: all.min.y - b.min.y }));
    case 'top':
      return boxes.map((b) => ({ x: 0, y: all.max.y - b.max.y }));
    case 'centerY':
      return boxes.map((b) => ({ x: 0, y: mid(all, 'y') - mid(b, 'y') }));
    case 'spreadX':
    case 'spreadY': {
      const axis = how === 'spreadX' ? 'x' : 'y';
      // In the order they stand along the axis: the first and the last stay, the gaps between all equal.
      const order = boxes.map((_, i) => i).sort((i, j) => mid(boxes[i]!, axis) - mid(boxes[j]!, axis));
      const sizes = order.reduce((t, i) => t + (boxes[i]!.max[axis] - boxes[i]!.min[axis]), 0);
      const first = boxes[order[0]!]!;
      const last = boxes[order.at(-1)!]!;
      const gap = (last.max[axis] - first.min[axis] - sizes) / (order.length - 1);
      const steps = boxes.map(() => ({ x: 0, y: 0 }));
      let at = first.min[axis];
      for (const i of order) {
        const b = boxes[i]!;
        steps[i] = axis === 'x' ? { x: at - b.min.x, y: 0 } : { x: 0, y: at - b.min.y };
        at += b.max[axis] - b.min[axis] + gap;
      }
      return steps;
    }
  }
}
