// Case table. Every expected polygon and area below is worked out by hand, not taken from the engine.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import type { ReferenceLine } from '../../../src/elements/wall/schema';
import { geometry, testWall, type TestWall as Wall } from './fixtures';
import { shoelace } from './oracle';

type XY = readonly [number, number];

const wall = (id: string, a: XY, b: XY, thickness: number, referenceLine: ReferenceLine = 'centerline'): Wall =>
  testWall(id, vec(a[0], a[1]), vec(b[0], b[1]), thickness, referenceLine);

const piecesOf = (walls: Wall[]) => geometry(walls).pieces;
const only = (walls: Wall[], id: string) => {
  const ps = piecesOf(walls).get(id)!;
  expect(ps).toHaveLength(1);
  return ps[0]!.polygon;
};
const totalArea = (walls: Wall[]) =>
  [...piecesOf(walls).values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);

/** Same vertex set, any starting vertex, to 1e-12 m. */
function expectPolygon(actual: readonly { x: number; y: number }[], expected: readonly XY[]): void {
  expect(actual).toHaveLength(expected.length);
  for (const [x, y] of expected) {
    const hit = actual.some((p) => Math.abs(p.x - x) < 1e-12 && Math.abs(p.y - y) < 1e-12);
    expect(hit, `missing vertex (${x}, ${y}) in ${JSON.stringify(actual)}`).toBe(true);
  }
}

describe('L corners', () => {
  it('90°, 20 cm on the axis: miter through (−0.1, −0.1) and (0.1, 0.1)', () => {
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [0, 0], [0, 3], 0.2)];
    expectPolygon(only(walls, 'a'), [[-0.1, -0.1], [4, -0.1], [4, 0.1], [0.1, 0.1]]);
    expectPolygon(only(walls, 'b'), [[-0.1, -0.1], [0.1, 0.1], [0.1, 3], [-0.1, 3]]);
    expect(totalArea(walls)).toBeCloseTo(0.82 + 0.58, 12);
  });

  it('90° drawn head to tail (end meets start) gives the same corner', () => {
    const walls = [wall('a', [4, 0], [0, 0], 0.2), wall('b', [0, 0], [0, 3], 0.2)];
    expect(totalArea(walls)).toBeCloseTo(1.4, 12);
  });

  it('30°, 20 cm: the miter is the bisector, inner corner at x = 0.1/tan 15° = 0.2 + 0.1√3', () => {
    const c = 0.2 + 0.1 * Math.sqrt(3);
    const r = (deg: number) => (deg * Math.PI) / 180;
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [0, 0], [4 * Math.cos(r(30)), 4 * Math.sin(r(30))], 0.2)];
    expectPolygon(only(walls, 'a'), [[-c, -0.1], [4, -0.1], [4, 0.1], [c, 0.1]]);
  });

  it('exterior-face reference: location line on the outer face, corner square split on its diagonal', () => {
    // a along +x: band on its left, y ∈ [0, 0.2]. b drawn downward: left normal (1, 0), band x ∈ [0, 0.2].
    // Corner square [0, 0.2]² is split on the diagonal from (0, 0) to (0.2, 0.2).
    const walls = [
      wall('a', [0, 0], [4, 0], 0.2, 'exteriorFace'),
      wall('b', [0, 3], [0, 0], 0.2, 'exteriorFace'),
    ];
    expectPolygon(only(walls, 'a'), [[0, 0], [4, 0], [4, 0.2], [0.2, 0.2]]);
    expectPolygon(only(walls, 'b'), [[0, 0], [0.2, 0.2], [0.2, 3], [0, 3]]);
  });

  it('ends 0.8 mm apart still join; corners come from the faces, so nothing opens', () => {
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [0.0008, 0], [0.0008, 3], 0.2)];
    // Region: (−0.0992..4) × (−0.1..0.1) plus b above y = 0.1: 4.0992·0.2 + 0.2·2.9
    expect(totalArea(walls)).toBeCloseTo(0.81984 + 0.58, 12);
  });

  it('4°: miter tip past 10 × thickness is bevelled at exactly 2.0 m behind the node', () => {
    const r = (2 * Math.PI) / 180;
    const walls = [wall('a', [0, 0], [6, 0], 0.2), wall('b', [0, 0], [6 * Math.cos(2 * r), 6 * Math.sin(2 * r)], 0.2)];
    const back = vec(-Math.cos(r), -Math.sin(r));
    const reach = [...piecesOf(walls).values()].flat().flatMap((p) => p.polygon).map((p) => p.x * back.x + p.y * back.y);
    expect(Math.max(...reach)).toBeCloseTo(2, 12);
    expect(geometry(walls).warnings).toEqual([]);
  });

  it('folded back (0.3°) does not join and warns wallsOverlap', () => {
    const r = (0.3 * Math.PI) / 180;
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [0, 0], [4 * Math.cos(r), 4 * Math.sin(r)], 0.2)];
    expect(geometry(walls).warnings).toEqual([{ kind: 'wallsOverlap', walls: ['a', 'b'] }]);
  });

  it('stub shorter than the other wall\'s half thickness warns wallsOverlap', () => {
    const walls = [wall('a', [0, 0], [4, 0], 0.4), wall('b', [0, 0], [0, 0.1], 0.1)];
    expect(geometry(walls).warnings.map((w) => w.kind)).toEqual(['wallsOverlap']);
  });

  it('in line (179.8°) with 30 and 10 cm: one shared cut, areas add up with no overlap', () => {
    const r = (0.2 * Math.PI) / 180;
    const walls = [wall('a', [0, 0], [4, 0], 0.3), wall('b', [0, 0], [-4 * Math.cos(r), 4 * Math.sin(r)], 0.1)];
    // The cut is the line through the origin at 90.1°; each wall keeps a trapezoid of mean length 4.
    expect(totalArea(walls)).toBeCloseTo(4 * 0.3 + 4 * 0.1, 12);
  });
});

describe('corners whose ends overran each other', () => {
  it('90°, each end 5 cm past the other: the same miter as ends that touch', () => {
    const walls = [wall('a', [-0.05, 0], [4, 0], 0.2), wall('b', [0, -0.05], [0, 3], 0.2)];
    expectPolygon(only(walls, 'a'), [[-0.1, -0.1], [4, -0.1], [4, 0.1], [0.1, 0.1]]);
    expectPolygon(only(walls, 'b'), [[-0.1, -0.1], [0.1, 0.1], [0.1, 3], [-0.1, 3]]);
    expect(geometry(walls).warnings).toEqual([]);
  });

  it('nearly in line (179°) and overlapping 0.5 m: the lines cross 5 m away, so wallsOverlap', () => {
    const r = Math.PI / 180;
    const ub = [Math.cos(179 * r), Math.sin(179 * r)] as const;
    const walls = [
      wall('a', [5, 0], [12, 0], 0.2),
      wall('b', [7 * ub[0], 7 * ub[1]], [-5.5 * ub[0], -5.5 * ub[1]], 0.2),
    ];
    expect(geometry(walls).warnings).toEqual([{ kind: 'wallsOverlap', walls: ['a', 'b'] }]);
  });

  it('a free end inside a parallel wall warns wallsOverlap instead of forming a T', () => {
    // Only b's start lies in the other band (a's end at y = 0 is outside b's band [0.055, 0.105]).
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [3, 0.08], [7, 0.08], 0.05)];
    expect(geometry(walls).warnings).toEqual([{ kind: 'wallsOverlap', walls: ['b', 'a'] }]);
    expectPolygon(only(walls, 'b'), [[3, 0.055], [7, 0.055], [7, 0.105], [3, 0.105]]);
  });
});

describe('T joins', () => {
  it('15 cm into 20 cm on the axis stops exactly on the near face', () => {
    const walls = [wall('host', [0, 0], [6, 0], 0.2), wall('t', [3, 0], [3, 2], 0.15)];
    expectPolygon(only(walls, 't'), [[2.925, 0.1], [3.075, 0.1], [3.075, 2], [2.925, 2]]);
    expectPolygon(only(walls, 'host'), [[0, -0.1], [6, -0.1], [6, 0.1], [0, 0.1]]);
  });

  it('drawn toward the host gives the same piece', () => {
    const walls = [wall('host', [0, 0], [6, 0], 0.2), wall('t', [3, 2], [3, 0], 0.15)];
    expectPolygon(only(walls, 't'), [[2.925, 0.1], [3.075, 0.1], [3.075, 2], [2.925, 2]]);
  });

  it('end 0.9 mm short of the face is extended to it', () => {
    const walls = [wall('host', [0, 0], [6, 0], 0.2), wall('t', [3, 0.1009], [3, 2], 0.15)];
    expectPolygon(only(walls, 't'), [[2.925, 0.1], [3.075, 0.1], [3.075, 2], [2.925, 2]]);
  });

  it('oblique at 45°: cut on the face line, nothing below y = 0.1', () => {
    const walls = [wall('host', [0, 0], [6, 0], 0.2), wall('t', [3, 0], [5, 2], 0.1)];
    // The cut vertices are computed intersections: on the face to float rounding, never past it.
    const ys = only(walls, 't').map((p) => p.y);
    expect(Math.min(...ys)).toBeCloseTo(0.1, 14);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.1 - 1e-15);
  });
});

describe('room 8 × 6 with a divider', () => {
  const ring = (t: number, ref: ReferenceLine) => [
    wall('w0', [0, 0], [8, 0], t, ref),
    wall('w1', [8, 0], [8, 6], t, ref),
    wall('w2', [8, 6], [0, 6], t, ref),
    wall('w3', [0, 6], [0, 0], t, ref),
  ];

  it('on the axis: outer 8.2 × 6.2, inner 7.8 × 5.8, divider 0.15 × 5.8', () => {
    const walls = [...ring(0.2, 'centerline'), wall('d', [4, 0], [4, 6], 0.15)];
    expect(totalArea(walls)).toBeCloseTo(8.2 * 6.2 - 7.8 * 5.8 + 0.15 * 5.8, 12);
    expectPolygon(only(walls, 'd'), [[3.925, 0.1], [4.075, 0.1], [4.075, 5.9], [3.925, 5.9]]);
    expect(geometry(walls).warnings).toEqual([]);
  });

  it('on the exterior face: outer 8 × 6, inner 7.6 × 5.6, divider 0.15 × 5.6', () => {
    const walls = [...ring(0.2, 'exteriorFace'), wall('d', [4, 0], [4, 6], 0.15)];
    expect(totalArea(walls)).toBeCloseTo(8 * 6 - 7.6 * 5.6 + 0.15 * 5.6, 12);
    expectPolygon(only(walls, 'd'), [[3.925, 0.2], [4.075, 0.2], [4.075, 5.8], [3.925, 5.8]]);
  });

  it('on the interior face: outer 8.4 × 6.4, inner 8 × 6', () => {
    const walls = [...ring(0.2, 'interiorFace'), wall('d', [4, 0], [4, 6], 0.15)];
    expect(totalArea(walls)).toBeCloseTo(8.4 * 6.4 - 8 * 6 + 0.15 * 6, 12);
  });
});

describe('warnings and determinism', () => {
  it('three ends at one point warn complexJoin', () => {
    const walls = [wall('a', [0, 0], [4, 0], 0.2), wall('b', [0, 0], [0, 3], 0.2), wall('c', [0, 0], [-3, 0], 0.2)];
    expect(geometry(walls).warnings).toEqual([{ kind: 'complexJoin', walls: ['a', 'b', 'c'] }]);
  });

  it('a wall shorter than 1 mm warns wallTooShort and is still drawn', () => {
    const walls = [wall('a', [0, 0], [0.0005, 0], 0.2)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([{ kind: 'wallTooShort', walls: ['a'] }]);
    expect(g.pieces.get('a')).toHaveLength(1);
  });

  it('input order does not change a single bit of the output', () => {
    const walls = [
      wall('w0', [0, 0], [8, 0], 0.2),
      wall('w1', [8, 0], [8, 6], 0.2),
      wall('w2', [8, 6], [0, 6], 0.2),
      wall('w3', [0, 6], [0, 0], 0.2),
      wall('d', [4, 0], [4, 6], 0.15),
    ];
    const dump = (ws: Wall[]) => JSON.stringify([...geometry(ws).pieces].sort());
    expect(dump([...walls].reverse())).toBe(dump(walls));
    expect(dump([walls[3]!, walls[0]!, walls[4]!, walls[2]!, walls[1]!])).toBe(dump(walls));
  });
});
