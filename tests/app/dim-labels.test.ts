// The values of the temporary dimensions never sit on one another (the tester's P03, P06: a small arc
// on screen showed its chord and radius as "2,50 00"). Each slides along its own line, either way,
// until clear of those placed before it; with no room on its line, it steps off it.

import { describe, expect, it } from 'vitest';
import { separateLabels } from '../../src/session/dim-labels';

const meets = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) => Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h;

describe('separateLabels', () => {
  it('apart already: where they are, the middles of their lines', () => {
    const out = separateLabels([
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, w: 40, h: 20 },
      { a: { x: 0, y: 100 }, b: { x: 100, y: 100 }, w: 40, h: 20 },
    ]);
    expect(out).toEqual([{ x: 50, y: 0 }, { x: 50, y: 100 }]);
  });

  it('two crossing at their middles: the second slides along its own line until clear', () => {
    const out = separateLabels([
      { a: { x: 0, y: 50 }, b: { x: 100, y: 50 }, w: 40, h: 20 },
      { a: { x: 50, y: 0 }, b: { x: 50, y: 100 }, w: 40, h: 20 },
    ]);
    expect(out[0]).toEqual({ x: 50, y: 50 });
    expect(out[1]!.x).toBe(50);
    expect(meets(out[0]!, out[1]!, 40, 20)).toBe(false);
  });

  it('a line too short to clear: it steps off the line, still not on the other', () => {
    const out = separateLabels([
      { a: { x: 0, y: 50 }, b: { x: 100, y: 50 }, w: 40, h: 20 },
      { a: { x: 45, y: 50 }, b: { x: 55, y: 50 }, w: 40, h: 20 },
    ]);
    expect(meets(out[0]!, out[1]!, 40, 20)).toBe(false);
  });
});
