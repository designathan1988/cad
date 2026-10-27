// Align and distribute any selection (phase 9): the step each box takes.

import { describe, expect, it } from 'vitest';
import { arrangeSteps, boxOf, type Box } from '../../src/tools/arrange';

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ min: { x: x0, y: y0 }, max: { x: x1, y: y1 } });
const moved = (b: Box, s: { x: number; y: number }) => box(b.min.x + s.x, b.min.y + s.y, b.max.x + s.x, b.max.y + s.y);

describe('align', () => {
  const boxes = [box(0, 0, 1, 1), box(3, 2, 5, 3), box(1.5, 5, 2, 7)];

  it("to the selection's left, right and centre across, nothing moving up", () => {
    const left = arrangeSteps(boxes, 'left').map((s, i) => moved(boxes[i]!, s));
    expect(left.map((b) => b.min.x)).toEqual([0, 0, 0]);
    expect(left.map((b) => b.min.y)).toEqual([0, 2, 5]);
    const right = arrangeSteps(boxes, 'right').map((s, i) => moved(boxes[i]!, s));
    expect(right.map((b) => b.max.x)).toEqual([5, 5, 5]);
    const centre = arrangeSteps(boxes, 'centerX').map((s, i) => moved(boxes[i]!, s));
    for (const b of centre) expect((b.min.x + b.max.x) / 2).toBeCloseTo(2.5, 12);
  });

  it("to the selection's bottom, top and middle", () => {
    const top = arrangeSteps(boxes, 'top').map((s, i) => moved(boxes[i]!, s));
    expect(top.map((b) => b.max.y)).toEqual([7, 7, 7]);
    expect(top.map((b) => b.min.x)).toEqual([0, 3, 1.5]);
    const bottom = arrangeSteps(boxes, 'bottom').map((s, i) => moved(boxes[i]!, s));
    expect(bottom.map((b) => b.min.y)).toEqual([0, 0, 0]);
    const middle = arrangeSteps(boxes, 'centerY').map((s, i) => moved(boxes[i]!, s));
    for (const b of middle) expect((b.min.y + b.max.y) / 2).toBeCloseTo(3.5, 12);
  });

  it('one box alone does not move', () => {
    expect(arrangeSteps([box(0, 0, 1, 1)], 'left')).toEqual([{ x: 0, y: 0 }]);
  });
});

describe('distribute', () => {
  it('equal gaps between the boxes, the first and the last staying, whatever order they were picked in', () => {
    const boxes = [box(10, 0, 12, 1), box(0, 0, 1, 1), box(3, 0, 4, 1), box(4.5, 0, 6.5, 1)];
    const out = arrangeSteps(boxes, 'spreadX').map((s, i) => moved(boxes[i]!, s));
    expect(out[0]!.max.x).toBeCloseTo(12, 12);
    expect(out[1]!.min.x).toBeCloseTo(0, 12);
    const sorted = [...out].sort((a, b) => a.min.x - b.min.x);
    const gaps = sorted.slice(1).map((b, i) => b.min.x - sorted[i]!.max.x);
    // 12 m in all, 6 m of boxes, three gaps of 2 m.
    for (const g of gaps) expect(g).toBeCloseTo(2, 12);
    expect(out.every((b) => b.min.y === 0)).toBe(true);
  });

  it('up, too; two boxes have nothing between them', () => {
    const boxes = [box(0, 0, 1, 1), box(0, 9, 1, 10), box(0, 2, 1, 3)];
    const out = arrangeSteps(boxes, 'spreadY').map((s, i) => moved(boxes[i]!, s));
    expect(out[2]!.min.y).toBeCloseTo(4.5, 12);
    expect(arrangeSteps(boxes.slice(0, 2), 'spreadY')).toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  });

  it('the box around points', () => {
    expect(boxOf([{ x: 1, y: 5 }, { x: -2, y: 3 }])).toEqual(box(-2, 3, 1, 5));
    expect(boxOf([])).toBeNull();
  });
});
