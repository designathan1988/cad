// The arc oracle's own helpers, against cases worked out by hand.

import { describe, expect, it } from 'vitest';
import { layer, testWall, type TestWall as Wall } from './fixtures';
import { cornerReach, distanceToSegments, segmentsOf, segmentWall, sharedArea, tBeyond, tFill, touchesArcElsewhere } from './oracle-arc';

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

describe('tFill: what a T against an arc fills past the wall end, up to the face', () => {
  // The arc from (0, 0) to (6, 0) with bulge -1: above y = 0, centre (3, 0), r = 3, 20 cm: band 2.9 to 3.1.
  const ring = { ...testWall('arc', { x: 0, y: 0 }, { x: 6, y: 0 }, [layer(0.2)]), bulge: -1 } as Wall;

  it('a wall at 45° from the upper right ending at (3, 3.05): its square end leaves a gap at the face, filled', () => {
    // Into the body is (1, 1)/√2, so past the end is x + y < 6.05. (2.94, 3.10): x + y = 6.04; across
    // the wall (x − y + 0.05)/√2 = −0.078, inside its ±0.1; radius √(0.06² + 3.1²) = 3.1006, past the
    // outer face 3.1, so outside the arc: the gap between the square end and the curved face.
    const wall = testWall('t', { x: 4, y: 4.05 }, { x: 3, y: 3.05 }, [layer(0.2)]);
    const fill = tFill(ring, wall);
    expect(fill({ x: 2.94, y: 3.1 })).toBe(true);
    // (2.94, 3.0): radius 3.0006, inside the arc's band, so the arc's own, not filled.
    expect(fill({ x: 2.94, y: 3.0 })).toBe(false);
    // Behind the end (x + y > 6.05): the wall's own body, not filled.
    expect(fill({ x: 3.1, y: 3.1 })).toBe(false);
    // Outside the wall's width: not its T.
    expect(fill({ x: 2.7, y: 3.2 })).toBe(false);
  });

  it('not across the ring: past the far side, where a band through the ring meets the arc again', () => {
    // A horizontal wall from (-1, 1.525) to the left of the band at radius 3.05 (x = 0.3586); its band
    // goes on across the ring and out at x = 5.70. (5.75, 1.525), radius 3.1445, is past the far face:
    // the stretch back to the end runs 1.525 from the centre, inside the ring.
    const end = { x: 3 + 3.05 * Math.cos((5 * Math.PI) / 6), y: 3.05 * Math.sin((5 * Math.PI) / 6) };
    const wall = testWall('t', { x: -1, y: end.y }, end, [layer(0.2)]);
    expect(tFill(ring, wall)({ x: 5.75, y: end.y })).toBe(false);
  });
});

describe('tBeyond: what of the abutting wall lies past the arc, which a T does not keep', () => {
  const ring = { ...testWall('arc', { x: 0, y: 0 }, { x: 6, y: 0 }, [layer(0.2)]), bulge: -1 } as Wall;
  // From inside the ring at 45°, ending at (3, 3.05): its square end's corner (2.9293, 3.1207) is at
  // radius 3.1215, past the outer face 3.1.
  const wall = testWall('t', { x: 2, y: 2.05 }, { x: 3, y: 3.05 }, [layer(0.2)]);
  const beyond = tBeyond(ring, wall);

  it("(2.935, 3.10): inside the wall's rectangle and at radius 3.1007, past the outer face: not kept", () => {
    // Into its body (−1, −1)/√2: 0.0106 behind the end; across (−1, 1)/√2: 0.081 of its ±0.1.
    expect(beyond({ x: 2.935, y: 3.1 })).toBe(true);
  });
  it('(2.95, 3.0) at radius 3.0004 is in the arc: the arc\'s; (2.5, 2.55) at radius 2.598 is on its own side: kept', () => {
    expect(beyond({ x: 2.95, y: 3.0 })).toBe(false);
    expect(beyond({ x: 2.5, y: 2.55 })).toBe(false);
  });
});

describe("cornerReach: how far along the wall an L's corner with the arc's end segment reaches", () => {
  it('the right-angle L of arcs.test.ts: 0.1 + 0.1·tan(Δ/2)', () => {
    // Arc (0, 0) to (6, 0), bulge −1, 20 cm: near the node its faces are x = ±0.1 + y·t, t = tan(Δ/2),
    // Δ = π/88. The wall from (−3, 0) has faces y = ±0.1. The four crossings, along (−1, 0) from the
    // node: ±(0.1 ± 0.1·t); the farthest, 0.1 + 0.1·t.
    const ring = { ...testWall('arc', { x: 0, y: 0 }, { x: 6, y: 0 }, [layer(0.2)]), bulge: -1 } as Wall;
    expect(segmentsOf(ring)).toBe(88);
    const t = Math.tan(Math.PI / 88 / 2);
    const wall = testWall('s', { x: -3, y: 0 }, { x: 0, y: 0 }, [layer(0.2)]);
    expect(cornerReach(ring, 'start', wall)).toBeCloseTo(0.1 + 0.1 * t, 12);
  });
});
