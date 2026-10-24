// Arc walls (docs/wall-joins-spec.md §5.2). The segmentation count is the spec's formula, written
// here on its own; every other expected value is worked out by hand from circles and chords.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import type { WallLayer } from '../../../src/elements/wall/schema';
import { geometry, layer, testWall, type TestWall } from './fixtures';
import { shoelace } from './oracle';

const SPEC_ARC_SAG = 5e-4;
const segmentsFor = (sweep: number, rMax: number) => Math.max(1, Math.ceil(Math.abs(sweep) / (2 * Math.acos(1 - SPEC_ARC_SAG / rMax))));

const arc = (id: string, start: [number, number], end: [number, number], bulge: number, layers: number | WallLayer[]): TestWall => ({
  ...testWall(id, vec(start[0], start[1]), vec(end[0], end[1]), layers),
  bulge,
});

const plastered = [layer(0.02, 'finish1'), layer(0.15, 'structure'), layer(0.03, 'finish2')];

describe('a lone arc wall', () => {
  // Semicircle from (0, 0) to (6, 0), bulge 1: counter-clockwise, centre (3, 0), r = 3, bulging to the
  // right of the chord direction, so below y = 0. 20 cm on the axis: radii 2.9 and 3.1 (the left
  // normal points to the centre, so offset o is radius 3 − o).
  const w = arc('a', [0, 0], [6, 0], 1, 0.2);
  const g = geometry([w]);
  const pieces = g.pieces.get('a')!;
  const n = segmentsFor(Math.PI, 3.1);

  it(`splits into the spec's ${n} trapezoids, every vertex on one of the two circles`, () => {
    expect(g.warnings).toEqual([]);
    expect(pieces).toHaveLength(n);
    for (const p of pieces) {
      for (const v of p.polygon) {
        const r = Math.hypot(v.x - 3, v.y);
        expect(Math.min(Math.abs(r - 2.9), Math.abs(r - 3.1)), JSON.stringify(v)).toBeLessThan(1e-9);
        expect(v.y).toBeLessThan(1e-9);
      }
    }
  });

  it('the area is n trapezoids of (3.1² − 2.9²)/2 · sin(π/n)', () => {
    const total = pieces.reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo((n * (3.1 ** 2 - 2.9 ** 2) / 2) * Math.sin(Math.PI / n), 12);
  });

  it('the free ends are radial: on y = 0 at both ends', () => {
    const onAxis = pieces.flatMap((p) => p.polygon).filter((v) => Math.abs(v.y) < 1e-9).map((v) => Math.round(v.x * 1e6) / 1e6);
    expect([...new Set(onAxis)].sort((x, y) => x - y)).toEqual([-0.1, 0.1, 5.9, 6.1]);
  });

  it('a negative bulge bulges the other way: above y = 0', () => {
    const up = geometry([arc('a', [0, 0], [6, 0], -1, 0.2)]).pieces.get('a')!;
    for (const p of up) for (const v of p.polygon) expect(v.y).toBeGreaterThan(-1e-9);
  });

  it('layers: each layer piece has its vertices on that layer\'s two circles', () => {
    const lg = geometry([arc('a', [0, 0], [6, 0], 1, plastered)]).pieces.get('a')!;
    // Offsets −0.1, −0.08, 0.07, 0.1 → radii 3.1, 3.08, 2.93, 2.9.
    const radii = [3.1, 3.08, 2.93, 2.9];
    for (const p of lg) {
      for (const v of p.polygon) {
        const r = Math.hypot(v.x - 3, v.y);
        const ok = Math.abs(r - radii[p.layerIndex]!) < 1e-9 || Math.abs(r - radii[p.layerIndex + 1]!) < 1e-9;
        expect(ok, `layer ${p.layerIndex} vertex at r = ${r}`).toBe(true);
      }
    }
    expect(lg).toHaveLength(3 * segmentsFor(Math.PI, 3.1));
  });

  it('a radius smaller than the offset of a face is invalid: arcTooTight, nothing drawn', () => {
    // Quarter circle of radius 0.05 m with a 20 cm wall: the inner face would have a negative radius.
    const r = 0.05;
    const tight = arc('a', [0, 0], [r, r], Math.tan(Math.PI / 8), 0.2);
    const t = geometry([tight]);
    expect(t.warnings).toEqual([{ kind: 'arcTooTight', walls: ['a'] }]);
    expect(t.pieces.get('a')).toEqual([]);
  });
});

describe('arc joined to straight walls at its ends (L)', () => {
  // The reference's "arc + straight walls": the semicircle above y = 0 (bulge −1, centre (3, 0)) with
  // two walls coming up from y = −4 to its ends. At both ends the arc's tangent is vertical, so each is
  // an L at 180°, in line: one shared cut through the node, y = 0.
  const walls = [
    arc('arc', [0, 0], [6, 0], -1, 0.2),
    testWall('left', vec(0, -4), vec(0, 0), 0.2),
    testWall('right', vec(6, 0), vec(6, -4), 0.2),
  ];
  const g = geometry(walls);

  it('joins without a warning, straight walls cut square at y = 0', () => {
    expect(g.warnings).toEqual([]);
    const ys = g.pieces.get('left')!.flatMap((p) => p.polygon.map((v) => v.y));
    expect(Math.max(...ys)).toBeCloseTo(0, 12);
    expect(Math.min(...ys)).toBeCloseTo(-4, 12);
  });

  it('the total area is the two walls plus the arc', () => {
    const n = segmentsFor(Math.PI, 3.1);
    const arcArea = (n * (3.1 ** 2 - 2.9 ** 2) / 2) * Math.sin(Math.PI / n);
    const total = [...g.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(2 * 0.8 + arcArea, 10);
  });
});

describe('arc and straight wall at a right angle', () => {
  // The arc from (0, 0) to (6, 0), bulge −1: clockwise, above y = 0, centre (3, 0), r = 3; it leaves
  // the node upward. Its left normal there is (−1, 0), away from the centre, so offset o is radius
  // 3 + o: the face x = −0.1 near the node is r = 3.1 and x = 0.1 is r = 2.9. The straight wall comes
  // in from the left: band y ∈ [−0.1, 0.1]. Same type, 90°: a miter.
  // Near the node the arc's faces are its first chords, from angle π to π − Δ (Δ = π/n): the chord of
  // radius R through (3 − R, 0) runs along (tan(Δ/2), 1), so on y = ±0.1 it is at x = 3 − R ± 0.1·tan(Δ/2).
  const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('s', vec(-3, 0), vec(0, 0), 0.2)];
  const g = geometry(walls);
  const t = Math.tan(Math.PI / segmentsFor(Math.PI, 3.1) / 2);

  it('joins without a warning', () => {
    expect(g.warnings).toEqual([]);
  });

  it('the miter runs from the outer corner (0.1 − 0.1·tan(Δ/2), −0.1) to the inner (−0.1 + 0.1·tan(Δ/2), 0.1)', () => {
    const vs = g.pieces.get('s')!.flatMap((p) => p.polygon);
    const has = (x: number, y: number) => vs.some((v) => Math.abs(v.x - x) < 1e-12 && Math.abs(v.y - y) < 1e-12);
    expect(has(0.1 - 0.1 * t, -0.1), JSON.stringify(vs)).toBe(true);
    expect(has(-0.1 + 0.1 * t, 0.1), JSON.stringify(vs)).toBe(true);
  });
});

describe('Ts and Xs against an arc', () => {
  it('a straight wall wider than one chord, abutting the arc, warns complexJoin and stays square', () => {
    // r = 3, chords of about 11 cm; a 30 cm wall cannot meet a single chord.
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(3, 1), vec(3, 2.95), 0.3)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([{ kind: 'complexJoin', walls: ['t', 'arc'] }]);
    expect(g.pieces.get('t')).toHaveLength(1);
  });

  it('a narrow wall meeting one chord abuts it exactly: its end is on that chord', () => {
    // Abutting along the radial through the middle of segment k: the chord there is perpendicular to
    // that radial at distance R·cos(Δ/2) from the centre, with R = 2.9 the inner face it meets.
    const n = segmentsFor(Math.PI, 3.1);
    const k = Math.floor(n / 2);
    const mid = Math.PI - ((k + 0.5) * Math.PI) / n; // the arc runs from π down to 0, counter-clockwise reversed
    const u = vec(Math.cos(mid), Math.sin(mid));
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(3 + u.x, u.y), vec(3 + 2.95 * u.x, 2.95 * u.y), 0.04)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    const reach = Math.max(...g.pieces.get('t')!.flatMap((p) => p.polygon).map((v) => (v.x - 3) * u.x + v.y * u.y));
    expect(reach).toBeCloseTo(2.9 * Math.cos(Math.PI / n / 2), 12);
  });

  it('a straight wall crossing an arc warns complexJoin', () => {
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('x', vec(3, 2), vec(3, 4), 0.1)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([{ kind: 'complexJoin', walls: ['x', 'arc'] }]);
  });
});
