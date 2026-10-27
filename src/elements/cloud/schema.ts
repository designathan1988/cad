// Revision clouds (docs/plano-de-escopo.md, phase 10: "nuvem de revisão"): a rectangle on a level drawn
// as a chain of arcs round what changed, with the revision's mark (A, B, 1…) in a triangle at its corner
// and an optional note, as the drawings of a revision show it. In plan and on the sheets' plans.

import type { Point2 } from '../../core/vector';

export const CLOUD_PREFIX = 'cloud';

export interface Cloud {
  readonly id: string;
  readonly levelId: string;
  /** Two opposite corners. */
  readonly a: Point2;
  readonly b: Point2;
  /** The revision's mark: "A", "1". */
  readonly revision: string;
  /** What changed, said beside the mark. */
  readonly note?: string;
}

/** The cloud's rectangle, counter-clockwise from its lowest corner. */
export function cloudRing(c: Pick<Cloud, 'a' | 'b'>): Point2[] {
  const x0 = Math.min(c.a.x, c.b.x);
  const x1 = Math.max(c.a.x, c.b.x);
  const y0 = Math.min(c.a.y, c.b.y);
  const y1 = Math.max(c.a.y, c.b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/** The next revision mark after the clouds there are: A, B… after the highest letter; 1 after the highest number. */
export function nextRevision(clouds: readonly Cloud[]): string {
  const letters = clouds.map((c) => c.revision).filter((r) => /^[A-Z]$/.test(r));
  const numbers = clouds.map((c) => Number(c.revision)).filter((n) => Number.isInteger(n) && n > 0);
  if (numbers.length > 0 && letters.length === 0) return String(Math.max(...numbers) + 1);
  if (letters.length === 0) return 'A';
  const top = Math.max(...letters.map((l) => l.charCodeAt(0)));
  return top >= 90 ? 'A' : String.fromCharCode(top + 1);
}
