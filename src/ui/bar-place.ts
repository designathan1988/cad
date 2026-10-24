// The vertical place of the floating bar (pure): above the selection, moved up past each box it would
// cover in its own columns until free; if that leaves the top of the view, below the selection, moved
// down past the boxes there the same way; if that leaves the bottom too, the nearest free place inside
// the view. Boxes elsewhere in the view never move it.

export interface Span {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const GAP_SELECTION = 10;
const GAP_BOX = 8;
const EDGE = 8;

export function placeBarY(
  bar: { left: number; w: number; h: number },
  selection: { top: number; bottom: number },
  boxes: readonly Span[],
  view: { h: number },
): number {
  const inColumns = boxes.filter((b) => b.left < bar.left + bar.w && bar.left < b.right);
  const hit = (y: number) => inColumns.find((b) => b.top < y + bar.h && y < b.bottom);
  let y = selection.top - GAP_SELECTION - bar.h;
  for (let b = hit(y), n = 0; b && n < boxes.length; b = hit(y), n++) y = b.top - GAP_BOX - bar.h;
  if (y >= EDGE) return y;
  y = selection.bottom + GAP_SELECTION;
  for (let b = hit(y), n = 0; b && n < boxes.length; b = hit(y), n++) y = b.bottom + GAP_BOX;
  y = Math.min(y, view.h - bar.h - EDGE);
  if (!hit(y)) return y;
  // No room above or below (a selection filling the view, a phone after F): clamped to the edge it
  // would sit on a handle. The nearest free place inside the view, searched outward from there.
  for (let d = STEP; d < view.h; d += STEP) {
    for (const c of [y - d, y + d]) if (c >= EDGE && c + bar.h <= view.h - EDGE && !hit(c)) return c;
  }
  return y;
}

const STEP = 4;
