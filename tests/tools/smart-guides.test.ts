// Smart guides while moving (phase 9): onto a neighbour's edge or centre within reach, the line shown;
// onto equal gaps between two neighbours, the gaps shown; nothing out of reach.

import { describe, expect, it } from 'vitest';
import type { Box } from '../../src/tools/arrange';
import { smartGuides } from '../../src/tools/smart-guides';

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ min: { x: x0, y: y0 }, max: { x: x1, y: y1 } });

describe('smart guides', () => {
  it("takes a left edge onto a neighbour's left edge within reach, and draws the line through both", () => {
    const moving = box(0, 0, 1, 1);
    const other = box(3.04, 5, 4.5, 6);
    const r = smartGuides(moving, [other], { x: 3, y: 0 }, 0.1);
    expect(r.delta.x).toBeCloseTo(3.04, 12);
    expect(r.delta.y).toBe(0);
    expect(r.lines).toEqual([{ a: { x: 3.04, y: 0 }, b: { x: 3.04, y: 6 } }]);
    expect(r.gaps).toEqual([]);
  });

  it('centres align too, and both axes at once', () => {
    const r = smartGuides(box(0, 0, 2, 2), [box(10, 10, 14, 14)], { x: 10.97, y: 0.05 }, 0.1);
    // Its centre x (1 + 10.97) onto the other's centre x 12: 11 across. Up, nothing is within reach.
    expect(r.delta.x).toBeCloseTo(11, 12);
    expect(r.delta.y).toBeCloseTo(0.05, 12);
  });

  it('out of reach, the move is left as it is', () => {
    const r = smartGuides(box(0, 0, 1, 1), [box(5.2, 5, 5.6, 6)], { x: 3, y: 0 }, 0.1);
    expect(r.delta).toEqual({ x: 3, y: 0 });
    expect(r.lines).toEqual([]);
  });

  it('between two neighbours, onto equal gaps, both gaps marked', () => {
    const left = box(0, 0, 1, 2);
    const right = box(5, 0, 6, 2);
    // A box 1 wide between 1 and 5: equal gaps of 1.5 put its left at 2.5.
    const r = smartGuides(box(0, 0.5, 1, 1.5), [left, right], { x: 2.45, y: 0 }, 0.1);
    expect(r.delta.x).toBeCloseTo(2.5, 12);
    expect(r.gaps).toHaveLength(2);
    const lens = r.gaps.map((g) => g.b.x - g.a.x);
    expect(lens[0]).toBeCloseTo(1.5, 12);
    expect(lens[1]).toBeCloseTo(1.5, 12);
  });
});
