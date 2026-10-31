// Editing an arc's curvature (the tester's review: a selected arc had no dimension and no handle).
// The arc through its two ends and a middle point at sagitta s off the chord c has bulge 2s / c,
// since bulge = tan(θ/4) and s / (c/2) = tan(θ/4).

import { describe, expect, it } from 'vitest';
import { arcMiddle, bulgeKeepingSide, bulgeFromMiddle, straightNear } from '../../src/elements/wall/arc-edit';

const a = { x: 0, y: 0 };
const b = { x: 2, y: 0 };

describe('bulgeFromMiddle', () => {
  it('a half circle through (1, -1), right of the chord from (0, 0) to (2, 0): bulge 1 (counter-clockwise)', () => {
    expect(bulgeFromMiddle(a, b, { x: 1, y: -1 })).toBeCloseTo(1, 12);
  });
  it('the other side: -1; on the chord: 0, a straight wall', () => {
    expect(bulgeFromMiddle(a, b, { x: 1, y: 1 })).toBeCloseTo(-1, 12);
    expect(bulgeFromMiddle(a, b, { x: 1, y: 0 })).toBe(0);
  });
  it('only the distance off the chord counts, not where along it', () => {
    expect(bulgeFromMiddle(a, b, { x: 0.3, y: -0.5 })).toBeCloseTo(0.5, 12);
  });
  it('never close to a full circle: at most a 340° sweep', () => {
    expect(bulgeFromMiddle(a, b, { x: 1, y: -100 })).toBeCloseTo(Math.tan((340 * Math.PI) / 180 / 4), 9);
  });
});

describe('arcMiddle', () => {
  it('the point bulgeFromMiddle came from, for the middle of the chord', () => {
    expect(arcMiddle(a, b, 1).x).toBeCloseTo(1, 12);
    expect(arcMiddle(a, b, 1).y).toBeCloseTo(-1, 12);
    expect(arcMiddle(a, b, -0.5).y).toBeCloseTo(0.5, 12);
  });
});

describe('bulgeKeepingSide', () => {
  it('chord 2, radius 1: the half circle, bulge 1 on the same side', () => {
    expect(bulgeKeepingSide(2, 0.3, 1)).toBeCloseTo(1, 12);
    expect(bulgeKeepingSide(2, -0.3, 1)).toBeCloseTo(-1, 12);
  });
  it('chord 2, radius 2: θ = 2·asin(1/2) = 60°, bulge tan(15°); a major arc keeps being one: 300°, tan(75°)', () => {
    expect(bulgeKeepingSide(2, 0.5, 2)).toBeCloseTo(Math.tan(Math.PI / 12), 12);
    expect(bulgeKeepingSide(2, 2, 2)).toBeCloseTo(Math.tan((5 * Math.PI) / 12), 12);
  });
  it('a radius shorter than half the chord cannot be: null', () => {
    expect(bulgeKeepingSide(2, 0.5, 0.99)).toBeNull();
  });
});

// The tester's K18: let go 4 px (about 3 cm) off the chord, the arc became R 39.62 m; the snap to
// straight was 2.5 cm in the world, so only a few pixels at most zooms. Now it is measured on screen.
describe('straightNear', () => {
  it('a sagitta under the given reach makes the wall straight', () => {
    // Chord 2, bulge 0.03: sagitta 0.03 m; within 8 px at 100 px/m (0.08 m) it is straight.
    expect(straightNear(0.03, 2, 8 / 100)).toBe(0);
    expect(straightNear(0.1, 2, 8 / 100)).toBe(0.1);
    expect(straightNear(-0.03, 2, 8 / 100)).toBe(0);
  });
});
