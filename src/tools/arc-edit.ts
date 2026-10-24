// An arc wall's curvature, edited by its middle point or its radius (pure). The arc through the two
// ends and a point at sagitta s off the chord c has bulge 2s / c: bulge = tan(θ/4) = s / (c/2). The
// ends never move, so the joins at them stay as they are. Drawing an arc is different
// (wall-tool.ts: bulgeThrough, the arc through a third point; bulgeForRadius, always the shorter arc).

import { distance, type Point2 } from '../core/vector';

/** A sweep of at most 340°: past that the arc nearly closes on itself. */
const MAX_BULGE = Math.tan((340 * Math.PI) / 180 / 4);

/** The bulge of the arc from `start` to `end` whose middle is as far off the chord as `p`. */
export function bulgeFromMiddle(start: Point2, end: Point2, p: Point2): number {
  const c = distance(start, end);
  if (c === 0) return 0;
  // Positive (counter-clockwise) bulges to the right of the chord, as DXF's do.
  const right = { x: (end.y - start.y) / c, y: -(end.x - start.x) / c };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const s = (p.x - mid.x) * right.x + (p.y - mid.y) * right.y;
  const bulge = (2 * s) / c;
  return Math.max(-MAX_BULGE, Math.min(MAX_BULGE, bulge)) || 0;
}

/** The middle point of the arc with this bulge: where its curvature handle sits. */
export function arcMiddle(start: Point2, end: Point2, bulge: number): Point2 {
  const c = distance(start, end);
  const s = (bulge * c) / 2;
  const right = c === 0 ? { x: 0, y: 0 } : { x: (end.y - start.y) / c, y: -(end.x - start.x) / c };
  return { x: (start.x + end.x) / 2 + right.x * s, y: (start.y + end.y) / 2 + right.y * s };
}

/**
 * The bulge giving the arc on chord `chord` the radius `radius`, on the same side and as a major arc
 * if it was one (|bulge| > 1). Null when the radius is shorter than half the chord.
 */
export function bulgeKeepingSide(chord: number, bulge: number, radius: number): number | null {
  if (!(radius >= chord / 2)) return null;
  const minor = 2 * Math.asin(Math.min(1, chord / (2 * radius)));
  const sweep = Math.abs(bulge) > 1 ? 2 * Math.PI - minor : minor;
  return Math.sign(bulge || 1) * Math.tan(sweep / 4);
}
