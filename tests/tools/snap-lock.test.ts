// Inference locks (phase 9): a point held to a direction from the last one (an arrow's axis, a wall's
// line or square to it, Shift's direction), stopping where it crosses a wall or a guide; and points the
// pointer rested on, aligned with across or up.

import { describe, expect, it } from 'vitest';
import { vec } from '../../src/model/vector';
import { snap } from '../../src/session/snap';
import { type SnapInput } from '../../src/session/snap-types';

const input = (cursor: [number, number], extra: Partial<SnapInput> = {}): SnapInput => ({
  cursor: vec(cursor[0], cursor[1]),
  mpp: 0.001,
  segments: [],
  from: vec(0, 0),
  chainStart: null,
  enabled: true,
  orthogonal: false,
  ...extra,
});

describe('a lock', () => {
  it('holds the point to the axis whatever the pointer does, its length on the grid', () => {
    const s = snap(input([3.012, 1.7], { lock: vec(1, 0) }));
    expect(s.kind).toBe('locked');
    expect(s.point.x).toBeCloseTo(3, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
    expect(s.guideFrom).toEqual(vec(0, 0));
    // Behind the last point too: the line both ways.
    expect(snap(input([-2.04, 0.9], { lock: vec(1, 0) })).point.x).toBeCloseTo(-2.05, 12);
  });

  it('along a wall at 30°, square to it: the point stays on that line', () => {
    const u = vec(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6));
    const square = vec(-u.y, u.x);
    const s = snap(input([-1, 2.1], { lock: square }));
    const along = s.point.x * u.x + s.point.y * u.y;
    expect(along).toBeCloseTo(0, 12);
  });

  it('stops where its line crosses a wall or a guide near the pointer, before the grid', () => {
    const wall = { start: vec(2.013, -1), end: vec(2.013, 1) };
    const s = snap(input([2.006, 0.4], { lock: vec(1, 0), segments: [wall] }));
    expect(s.point.x).toBeCloseTo(2.013, 12);
    expect(s.point.y).toBeCloseTo(0, 12);
    const g = snap(input([1.0, 0.3], { lock: vec(1, 0), guides: [{ point: vec(1.007, 5), dir: vec(0, 1) }] }));
    expect(g.point.x).toBeCloseTo(1.007, 12);
    // Far from the pointer, a crossing is not taken.
    expect(snap(input([0.5, 0.3], { lock: vec(1, 0), segments: [wall] })).point.x).toBeCloseTo(0.5, 12);
  });

  it('is nothing without a point drawn from', () => {
    expect(snap(input([3.012, 1.7], { lock: vec(1, 0), from: null })).kind).not.toBe('locked');
  });
});

describe('acquired points', () => {
  it('a point rested on aligns the next ones across or up, with its dashed line', () => {
    const s = snap(input([3.4, 2.003], { from: null, acquired: [vec(9, 2)] }));
    expect(s.kind).toBe('aligned');
    expect(s.point).toEqual(vec(3.4, 2));
    expect(s.guideFrom).toEqual(vec(9, 2));
    expect(snap(input([3.4, 2.003], { from: null })).kind).not.toBe('aligned');
  });
});
