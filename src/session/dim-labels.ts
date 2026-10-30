// Where the values of the temporary dimensions go (pure): at the middle of their lines, unless that
// puts one on another (a small element on screen). Then it slides along its own line, either way, in
// small steps, until clear of the values placed before it; a line too short for that leaves it beside
// the others instead, stepped off its line.

import type { Point2 } from '../model/vector';

export interface DimLabel {
  readonly a: Point2;
  readonly b: Point2;
  /** Its size on screen (px). */
  readonly w: number;
  readonly h: number;
}

const STEP = 4;

export function separateLabels(labels: readonly DimLabel[]): Point2[] {
  const placed: { at: Point2; w: number; h: number }[] = [];
  const clear = (at: Point2, w: number, h: number) =>
    placed.every((p) => Math.abs(p.at.x - at.x) >= (p.w + w) / 2 || Math.abs(p.at.y - at.y) >= (p.h + h) / 2);
  for (const l of labels) {
    const mid = { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2 };
    const len = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
    const u = len > 0 ? { x: (l.b.x - l.a.x) / len, y: (l.b.y - l.a.y) / len } : { x: 1, y: 0 };
    let at = mid;
    if (!clear(at, l.w, l.h)) {
      const along: Point2[] = [];
      for (let s = STEP; s <= len / 2; s += STEP) along.push({ x: mid.x + u.x * s, y: mid.y + u.y * s }, { x: mid.x - u.x * s, y: mid.y - u.y * s });
      // Off the line: below the others, one label's height at a time.
      const off: Point2[] = [];
      for (let k = 1; k <= labels.length + 1; k++) off.push({ x: mid.x, y: mid.y + k * l.h }, { x: mid.x, y: mid.y - k * l.h });
      at = [...along, ...off].find((p) => clear(p, l.w, l.h)) ?? mid;
    }
    placed.push({ at, w: l.w, h: l.h });
  }
  return placed.map((p) => p.at);
}
