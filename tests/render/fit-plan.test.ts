// Framing in plan fits the part of the canvas no panel covers (tablet drawer, phone sheet).

import { describe, expect, it } from 'vitest';
import { fitPlan } from '../../src/render/plan-view';

const box = { min: { x: 0, y: 0 }, max: { x: 10, y: 5 } };
// Where a world point lands on a canvas of width w, height h.
const toScreen = (fit: ReturnType<typeof fitPlan>, size: { w: number; h: number }, p: { x: number; y: number }) => ({
  x: size.w / 2 + (p.x - fit.center.x) * fit.scale,
  y: size.h / 2 - (p.y - fit.center.y) * fit.scale,
});

describe('fit in plan', () => {
  it('nothing covered: the box fills 70% of the limiting side, centred', () => {
    const size = { w: 1000, h: 800 };
    const f = fitPlan(box, size);
    expect(f.scale).toBeCloseTo(70, 9);
    expect(toScreen(f, size, { x: 5, y: 2.5 })).toEqual({ x: 500, y: 400 });
  });

  it('a 290 px drawer on the right of a 768 px tablet: the whole box stays left of it', () => {
    const size = { w: 720, h: 900 };
    const f = fitPlan(box, size, { right: 290, bottom: 0 });
    const a = toScreen(f, size, box.min);
    const b = toScreen(f, size, box.max);
    expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(720 - 290);
    expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(0);
    expect((a.x + b.x) / 2).toBeCloseTo((720 - 290) / 2, 9);
  });

  it('a sheet over the bottom 45% of a phone: the box stays above it', () => {
    const size = { w: 330, h: 700 };
    const f = fitPlan(box, size, { right: 0, bottom: 315 });
    const a = toScreen(f, size, box.min);
    const b = toScreen(f, size, box.max);
    expect(Math.max(a.y, b.y)).toBeLessThanOrEqual(700 - 315);
    expect((a.y + b.y) / 2).toBeCloseTo((700 - 315) / 2, 9);
  });

  it('the project browser over the left 260 px and the panel over the right 290 px: the box between them', () => {
    const size = { w: 1230, h: 640 };
    const f = fitPlan(box, size, { right: 290, bottom: 0, left: 260 });
    const a = toScreen(f, size, box.min);
    const b = toScreen(f, size, box.max);
    expect(Math.min(a.x, b.x)).toBeGreaterThanOrEqual(260);
    expect(Math.max(a.x, b.x)).toBeLessThanOrEqual(1230 - 290);
    expect((a.x + b.x) / 2).toBeCloseTo(260 + (1230 - 290 - 260) / 2, 9);
  });
});
