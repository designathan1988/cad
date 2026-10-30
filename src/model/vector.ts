export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Point2 => ({ x, y });
export const add = (a: Point2, b: Point2): Point2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Point2, b: Point2): Point2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Point2, s: number): Point2 => vec(a.x * s, a.y * s);
export const dot = (a: Point2, b: Point2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Point2, b: Point2): number => a.x * b.y - a.y * b.x;
export const length = (a: Point2): number => Math.hypot(a.x, a.y);
export const distance = (a: Point2, b: Point2): number => length(sub(a, b));
/** Left-hand perpendicular: rotates +90°. */
export const perp = (a: Point2): Point2 => vec(-a.y, a.x);

export function normalize(a: Point2): Point2 {
  const l = length(a);
  return l === 0 ? vec(0, 0) : scale(a, 1 / l);
}

/** Intersection of the lines p + s·u and q + t·v, or null when parallel. */
export function intersectLines(p: Point2, u: Point2, q: Point2, v: Point2): Point2 | null {
  const denom = cross(u, v);
  if (denom === 0) return null;
  const s = cross(sub(q, p), v) / denom;
  return add(p, scale(u, s));
}

/** Distance from p to the segment a–b. */
export function segmentDistance(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from p to an open polyline. */
export function polylineDistance(line: readonly Point2[], p: Point2): number {
  let d = Infinity;
  for (let i = 1; i < line.length; i++) d = Math.min(d, segmentDistance(p, line[i - 1]!, line[i]!));
  return d;
}

/** Even-odd ray crossing: is p inside the polygon? */
export function insidePolygon(poly: readonly Point2[], p: Point2): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Distance from p to a polygon: 0 inside, else to its nearest edge. */
export function polygonDistance(poly: readonly Point2[], p: Point2): number {
  if (insidePolygon(poly, p)) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, segmentDistance(p, poly[i]!, poly[(i + 1) % poly.length]!));
  return d;
}

/** Twice the signed area of a closed polygon (positive counter-clockwise). */
export function signedTwiceArea(poly: readonly Point2[]): number {
  let twice = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return twice;
}
