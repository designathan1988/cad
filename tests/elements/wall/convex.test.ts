import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import {
  area,
  clipHalfPlane,
  clipOutBand,
  halfPlaneThrough,
  toCounterClockwise,
} from '../../../src/elements/wall/geometry/convex';

const square = [vec(0, 0), vec(2, 0), vec(2, 2), vec(0, 2)];

describe('clipHalfPlane', () => {
  it('keeps the whole polygon when it is inside', () => {
    expect(clipHalfPlane(square, halfPlaneThrough(vec(5, 0), vec(-1, 0)))).toEqual(square);
  });

  it('returns nothing when the polygon is outside', () => {
    expect(clipHalfPlane(square, halfPlaneThrough(vec(5, 0), vec(1, 0)))).toEqual([]);
  });

  it('cuts a square in half exactly', () => {
    const left = clipHalfPlane(square, halfPlaneThrough(vec(1, 0), vec(-1, 0)));
    expect(area(left)).toBe(2);
    expect(left).toEqual([vec(0, 0), vec(1, 0), vec(1, 2), vec(0, 2)]);
  });

  it('cuts along a diagonal through two vertices without adding vertices', () => {
    const tri = clipHalfPlane(square, halfPlaneThrough(vec(0, 0), vec(1, -1)));
    expect(tri).toEqual([vec(0, 0), vec(2, 0), vec(2, 2)]);
    expect(area(tri)).toBe(2);
  });

  it('leaves no repeated vertex when the line touches one vertex only', () => {
    const out = clipHalfPlane(square, halfPlaneThrough(vec(2, 2), vec(-1, -1)));
    expect(new Set(out.map((p) => `${p.x},${p.y}`)).size).toBe(out.length);
    expect(area(out)).toBe(4);
  });

  it('never repeats a vertex when the cut passes within rounding of a kept one', () => {
    // At 10^6 m (UTM coordinates) the intersection 3e-11 m from a rounds onto a itself.
    const n = vec(0.6, -0.8);
    const a = vec(1e6, 1e6);
    const tri = [a, vec(1e6 + 0.6, 1e6 - 0.8), vec(1e6 - 0.2, 1e6 + 3.6)];
    const out = clipHalfPlane(tri, { normal: n, offset: -200000 + 2.9103830456733704e-11 });
    expect(out).toHaveLength(3);
    out.forEach((p, i) => expect(p).not.toEqual(out[(i + 1) % out.length]));
  });

  it('the two sides of a cut add up to the original area', () => {
    const line = vec(0.37, 1.91);
    const inward = vec(0.6, -0.8);
    const a = clipHalfPlane(square, halfPlaneThrough(line, inward));
    const b = clipHalfPlane(square, halfPlaneThrough(line, vec(-0.6, 0.8)));
    expect(area(a) + area(b)).toBeCloseTo(4, 12);
  });
});

describe('clipOutBand', () => {
  it('splits a square into two pieces with the band removed', () => {
    const pieces = clipOutBand(
      square,
      halfPlaneThrough(vec(0.5, 0), vec(-1, 0)),
      halfPlaneThrough(vec(1.5, 0), vec(1, 0)),
    );
    expect(pieces).toHaveLength(2);
    expect(pieces.reduce((s, p) => s + area(p), 0)).toBe(2);
  });
});

describe('toCounterClockwise', () => {
  it('reverses a clockwise polygon', () => {
    expect(toCounterClockwise([...square].reverse())).toEqual(square);
  });
});
