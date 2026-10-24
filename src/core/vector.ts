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
