// Point and circle guides (phase 9): valid as data, picked near their point or their circle, scaled
// with a transform; drawing snaps onto a circle and to where it crosses a line guide or a wall.

import { describe, expect, it } from 'vitest';
import { vec } from '../../src/model/vector';
import { guideKind } from '../../src/elements/kinds/guide';
import type { Guide } from '../../src/elements/guide/schema';
import { snap, type SnapInput } from '../../src/tools/snap';

const point: Guide = { id: 'guide_p', levelId: 'lvl_ground', point: vec(1, 1), dir: vec(1, 0), shape: 'point' };
const circle: Guide = { id: 'guide_c', levelId: 'lvl_ground', point: vec(0, 0), dir: vec(1, 0), shape: 'circle', radius: 2 };
const input = (cursor: [number, number], extra: Partial<SnapInput> = {}): SnapInput => ({
  cursor: vec(cursor[0], cursor[1]),
  mpp: 0.001,
  segments: [],
  from: null,
  chainStart: null,
  enabled: true,
  orthogonal: false,
  ...extra,
});

describe('point and circle guides', () => {
  it('are valid with their shape; a circle needs a radius', () => {
    expect(guideKind.valid(point)).toBe(true);
    expect(guideKind.valid(circle)).toBe(true);
    expect(guideKind.valid({ ...circle, radius: 0 })).toBe(false);
    expect(guideKind.valid({ ...circle, radius: undefined })).toBe(false);
    expect(guideKind.valid({ ...point, shape: 'square' })).toBe(false);
  });

  it('are picked near their point, or near their circle and not inside it', () => {
    expect(guideKind.hit(point, vec(1.01, 1), 0, 100)).toBe(true);
    expect(guideKind.hit(point, vec(1.5, 1), 0, 100)).toBe(false);
    expect(guideKind.hit(circle, vec(0, 2.02), 0, 100)).toBe(true);
    expect(guideKind.hit(circle, vec(0, 1), 0, 100)).toBe(false);
  });

  it('a circle is scaled with the transform it is copied by', () => {
    const t = { map: (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 }) };
    const copy = guideKind.mapped(circle, t as never, 'guide_c2');
    expect(copy.radius).toBeCloseTo(4, 12);
  });
});

describe('snapping onto a circle guide', () => {
  const circles = [{ center: vec(0, 0), radius: 2 }];

  it('the cursor near the circle goes onto it', () => {
    const s = snap(input([1.41, 1.42], { circles }));
    expect(s.kind).toBe('onGuide');
    expect(Math.hypot(s.point.x, s.point.y)).toBeCloseTo(2, 12);
  });

  it('where it crosses a line guide, and a wall', () => {
    const s = snap(input([2.004, 0.003], { circles, guides: [{ point: vec(-5, 0), dir: vec(1, 0) }] }));
    expect(s.kind).toBe('guideCross');
    expect(s.point.x).toBeCloseTo(2, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
    const w = snap(input([0.004, 2.003], { circles, segments: [{ start: vec(0, -5), end: vec(0, 5) }] }));
    expect(w.kind).toBe('guideCross');
    expect(w.point.y).toBeCloseTo(2, 12);
  });

  it('inside, away from it, nothing of it', () => {
    expect(snap(input([0.5, 0.5], { circles })).kind).not.toBe('onGuide');
  });
});
