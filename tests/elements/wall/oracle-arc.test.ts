// The arc oracle's own helpers, against cases worked out by hand.

import { describe, expect, it } from 'vitest';
import { layer, testWall, type TestWall as Wall } from './fixtures';
import { distanceToSegments, segmentsOf, segmentWall, sharedArea, touchesArcElsewhere } from './oracle-arc';

const sq = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe('sharedArea', () => {
  it('two 2 m squares offset by 1 m both ways share a 1 m square', () => {
    expect(sharedArea(sq(0, 0, 2, 2), sq(1, 1, 3, 3))).toBeCloseTo(1, 12);
  });
  it('squares 1 m apart share nothing', () => {
    expect(sharedArea(sq(0, 0, 1, 1), sq(2, 0, 3, 1))).toBe(0);
  });
  it('either winding: the unit square lies inside the clockwise triangle x + y <= 2', () => {
    const cw = [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }];
    expect(sharedArea(sq(0, 0, 1, 1), cw)).toBeCloseTo(1, 12);
    expect(sharedArea(cw, [...sq(0, 0, 1, 1)].reverse())).toBeCloseTo(1, 12);
  });
});

describe('touchesArcElsewhere', () => {
  // A half circle from (0, 0) to (2, 0), counter-clockwise: centre (1, 0), radius 1, through (1, -1).
  // Every segment but the ends lies strictly below y = 0.
  const arc = { ...testWall('arc', { x: 0, y: 0 }, { x: 2, y: 0 }, [layer(0.1)]), bulge: 1 } as Wall;
  it('a wall from (2, -2) to the start runs through (1, -1), the middle of the arc: it touches', () => {
    expect(touchesArcElsewhere(arc, 'start', testWall('s', { x: 2, y: -2 }, { x: 0, y: 0 }, [layer(0.1)]))).toBe(true);
  });
  it('a wall from (0, 2) to the start stays at y >= 0, above every other segment: it does not', () => {
    expect(touchesArcElsewhere(arc, 'start', testWall('s', { x: 0, y: 2 }, { x: 0, y: 0 }, [layer(0.1)]))).toBe(false);
  });
});

describe('segmentWall and distanceToSegments', () => {
  // The same half circle: centre (1, 0), radius 1, 0.1 m thick on its centre line.
  const arc = { ...testWall('arc', { x: 0, y: 0 }, { x: 2, y: 0 }, [layer(0.1)]), bulge: 1 } as Wall;
  it('the first segment starts at the arc start and ends on the circle, a little thinner', () => {
    const s = segmentWall(arc, 0);
    expect(s.start).toEqual({ x: 0, y: 0 });
    expect(Math.hypot(s.end.x - 1, s.end.y)).toBeCloseTo(1, 12);
    expect(s.end.y).toBeLessThan(0);
    expect(s.thickness).toBeLessThan(0.1);
    expect(s.thickness).toBeGreaterThan(0.0999);
  });
  it('(1, -1), on the centre line at the bottom, is on the arc: 0', () => {
    expect(distanceToSegments(arc, { x: 1, y: -1 })).toBe(0);
  });
  it("(1, 0.5), above the centre, is nearest the end segments' inner corners, (0.05, 0) and (1.95, 0)", () => {
    // 51 segments (Δ = π/51). The end is square to the chord, which tilts by Δ/2 from the tangent, so
    // the corner is (0.05·cos(Δ/2), 0.05·sin(Δ/2)) = (0.04998, 0.00154): hypot(0.95002, 0.49846) = 1.07289.
    expect(segmentsOf(arc)).toBe(51);
    expect(distanceToSegments(arc, { x: 1, y: 0.5 })).toBeCloseTo(1.07289, 4);
  });
  it('a point 0.5 mm outside the outer face at the bottom is within the 1 mm tolerance', () => {
    // The outer face circle has radius 1.05; the segments' rectangles reach it within the sag (0.5 mm),
    // so a point 0.5 mm past it is less than 1 mm from them.
    const d = distanceToSegments(arc, { x: 1, y: -1.0505 });
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1e-3);
  });
});
