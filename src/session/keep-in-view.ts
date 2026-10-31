// How far the plan moves so the selection stays seen (pure): its screen box, dimensions and handles
// included, inside the part of the view no panel, sheet or drawer covers, with room above it for the
// floating bar. The smallest move that does it; a box larger than that part keeps its top left in view.

import type { Insets } from '../render/plan-types';

export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The free part of the view: what no panel, sheet or drawer covers, less the margins and room above. */
function freeOf(view: { readonly w: number; readonly h: number }, covered: Insets, room: { readonly margin: number; readonly above: number }) {
  return {
    left: (covered.left ?? 0) + room.margin,
    right: view.w - covered.right - room.margin,
    top: room.margin + room.above,
    bottom: view.h - covered.bottom - room.margin,
  };
}

/** How much to zoom out (≤ 1) so the box fits the free part, with 5 % to spare; 1 when it fits. */
export function fitFactor(
  box: ScreenBox,
  view: { readonly w: number; readonly h: number },
  covered: Insets,
  room: { readonly margin: number; readonly above: number },
): number {
  const free = freeOf(view, covered, room);
  const k = Math.min((free.right - free.left) / (box.right - box.left), (free.bottom - free.top) / (box.bottom - box.top));
  return k >= 1 ? 1 : k * 0.95;
}

export function keepInView(
  box: ScreenBox,
  view: { readonly w: number; readonly h: number },
  covered: Insets,
  room: { readonly margin: number; readonly above: number },
): { dx: number; dy: number } {
  const free = freeOf(view, covered, room);
  const along = (lo: number, hi: number, min: number, max: number) => {
    if (lo < min) return min - lo;
    // Past the far edge: back by what sticks out, but never the near edge past its own limit.
    if (hi > max) return Math.max(max - hi, min - lo);
    return 0;
  };
  return { dx: along(box.left, box.right, free.left, free.right) || 0, dy: along(box.top, box.bottom, free.top, free.bottom) || 0 };
}
