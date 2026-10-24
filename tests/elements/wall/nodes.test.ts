// Nodes with 3, 4 and 5+ ends (docs/wall-joins-spec.md §7.4). Every expected value is worked out by hand.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import { geometry, layer, testWall } from './fixtures';
import { shoelace } from './oracle';

type XY = readonly [number, number];

/** Same vertex set, any starting vertex, to 1e-12 m. */
function expectPolygon(actual: readonly { x: number; y: number }[], expected: readonly XY[]): void {
  expect(actual).toHaveLength(expected.length);
  for (const [x, y] of expected) {
    const hit = actual.some((p) => Math.abs(p.x - x) < 1e-12 && Math.abs(p.y - y) < 1e-12);
    expect(hit, `missing vertex (${x}, ${y}) in ${JSON.stringify(actual)}`).toBe(true);
  }
}

// 20 cm: 2 cm exterior finish, 15 cm structure, 3 cm interior finish. On the axis and drawn along +x:
// finish 1 y ∈ [−0.1, −0.08], core y ∈ [−0.08, 0.07], finish 2 y ∈ [0.07, 0.1].
const plastered = [layer(0.02, 'finish1'), layer(0.15, 'structure'), layer(0.03, 'finish2')];
const thin = [layer(0.01, 'finish1'), layer(0.1, 'structure'), layer(0.01, 'finish2')];

describe('node with 3 ends: two in line and one more', () => {
  // a comes in along +x to the node, b leaves along +x: the passage, one straight band with the same
  // faces. c leaves upward: finish 1 x ∈ [0.05, 0.06], core x ∈ [−0.05, 0.05], finish 2 x ∈ [−0.06, −0.05].
  const a = testWall('a', vec(-4, 0), vec(0, 0), plastered);
  const b = testWall('b', vec(0, 0), vec(4, 0), plastered);
  const c = testWall('c', vec(0, 0), vec(0, 3), thin);
  const g = geometry([a, b, c]);
  const of = (id: string, k: number) => g.pieces.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);

  it('joins without a warning', () => {
    expect(g.warnings).toEqual([]);
  });

  it('a and b meet on one cut through the node, x = 0', () => {
    expectPolygon(of('a', 1)[0]!, [[-4, -0.08], [0, -0.08], [0, 0.07], [-4, 0.07]]);
    expectPolygon(of('b', 1)[0]!, [[0, -0.08], [4, -0.08], [4, 0.07], [0, 0.07]]);
  });

  it('c abuts the passage as a T: core and finish 1 to the core face, finish 2 on the face', () => {
    expectPolygon(of('c', 1)[0]!, [[-0.05, 0.07], [0.05, 0.07], [0.05, 3], [-0.05, 3]]);
    expectPolygon(of('c', 0)[0]!, [[0.05, 0.07], [0.06, 0.07], [0.06, 3], [0.05, 3]]);
    expectPolygon(of('c', 2)[0]!, [[-0.06, 0.1], [-0.05, 0.1], [-0.05, 3], [-0.06, 3]]);
  });

  it('both passage walls are notched where c passes, x ∈ [−0.05, 0.06]', () => {
    expect(of('a', 2)).toHaveLength(1);
    expectPolygon(of('a', 2)[0]!, [[-4, 0.07], [-0.05, 0.07], [-0.05, 0.1], [-4, 0.1]]);
    expect(of('b', 2)).toHaveLength(1);
    expectPolygon(of('b', 2)[0]!, [[0.06, 0.07], [4, 0.07], [4, 0.1], [0.06, 0.1]]);
  });

  it('the area is the straight band plus c beyond its face: 8 · 0.2 + 0.12 · 2.9', () => {
    const total = [...g.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1.6 + 0.12 * 2.9, 12);
  });
});

describe('node with 4 ends: four walls meeting at one point', () => {
  // As above, plus d leaving downward: finish 1 x ∈ [−0.06, −0.05], core x ∈ [−0.05, 0.05], finish 2
  // x ∈ [0.05, 0.06]. From below the passage shows finish 1 (4): d's finish 1 (4) and finish 2 (5)
  // stop on the face y = −0.1, its core on the core face y = −0.08.
  const walls = [
    testWall('a', vec(-4, 0), vec(0, 0), plastered),
    testWall('b', vec(0, 0), vec(4, 0), plastered),
    testWall('c', vec(0, 0), vec(0, 3), thin),
    testWall('d', vec(0, 0), vec(0, -3), thin),
  ];
  const g = geometry(walls);
  const of = (id: string, k: number) => g.pieces.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);

  it('joins without a warning; d abuts from below', () => {
    expect(g.warnings).toEqual([]);
    expectPolygon(of('d', 1)[0]!, [[-0.05, -0.08], [0.05, -0.08], [0.05, -3], [-0.05, -3]]);
    expectPolygon(of('d', 0)[0]!, [[-0.06, -0.1], [-0.05, -0.1], [-0.05, -3], [-0.06, -3]]);
  });

  it('the passage finish 1 is notched where the core of d passes, x ∈ [−0.05, 0.05]', () => {
    expectPolygon(of('a', 0)[0]!, [[-4, -0.1], [-0.05, -0.1], [-0.05, -0.08], [-4, -0.08]]);
    expectPolygon(of('b', 0)[0]!, [[0.05, -0.1], [4, -0.1], [4, -0.08], [0.05, -0.08]]);
  });

  it('the area is the band plus both stems beyond the faces', () => {
    const total = [...g.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1.6 + 2 * 0.12 * 2.9, 12);
  });
});

describe('node with 3 ends and no pair in line', () => {
  // a 30 cm along 0°, b 30 cm along 160°, c 10 cm along 30°; all single structure, on the axis.
  // No pair is within 10° of in line, so the passage is the two thickest cores, a and b. c leaves
  // inside their 160° wedge, clear of b, and abuts a's face y = 0.15. Its faces are the offsets ±0.05
  // along n = (−sin 30°, cos 30°); on y = 0.15 they meet at t = (0.15 − o·cos 30°)/sin 30°.
  const r = Math.PI / 180;
  const walls = [
    testWall('a', vec(0, 0), vec(4, 0), 0.3),
    testWall('b', vec(0, 0), vec(4 * Math.cos(160 * r), 4 * Math.sin(160 * r)), 0.3),
    testWall('c', vec(0, 0), vec(3 * Math.cos(30 * r), 3 * Math.sin(30 * r)), 0.1),
  ];
  const g = geometry(walls);

  it('c abuts a: cut on the face y = 0.15', () => {
    expect(g.warnings).toEqual([]);
    const u = vec(Math.cos(30 * r), Math.sin(30 * r));
    const n = vec(-Math.sin(30 * r), Math.cos(30 * r));
    const onFace = (o: number): XY => {
      const t = (0.15 - o * n.y) / u.y;
      return [o * n.x + t * u.x, 0.15];
    };
    const far = (o: number): XY => [3 * u.x + o * n.x, 3 * u.y + o * n.y];
    expectPolygon(g.pieces.get('c')![0]!.polygon, [onFace(-0.05), far(-0.05), far(0.05), onFace(0.05)]);
  });
});

describe('5 ends, and ends that do not fit', () => {
  it('five ends at one point: no joins, complexJoin', () => {
    const r = Math.PI / 180;
    const walls = [0, 72, 144, 216, 288].map((deg, i) =>
      testWall(`w${i}`, vec(0, 0), vec(3 * Math.cos(deg * r), 3 * Math.sin(deg * r)), 0.1),
    );
    const g = geometry(walls);
    expect(g.warnings).toEqual([{ kind: 'complexJoin', walls: ['w0', 'w1', 'w2', 'w3', 'w4'] }]);
    for (const w of walls) expect(g.pieces.get(w.id)).toHaveLength(1);
  });

  it('an end straddling a passage whose walls differ there warns complexJoin and stays square', () => {
    // a 20 cm and b 30 cm in line along x, both on the axis: their faces step at x = 0. c, 10 cm,
    // leaves upward across the step, so it is neither only against a nor against matching faces.
    const walls = [
      testWall('a', vec(-4, 0), vec(0, 0), 0.2),
      testWall('b', vec(0, 0), vec(4, 0), 0.3),
      testWall('c', vec(0, 0), vec(0, 3), 0.1),
    ];
    const g = geometry(walls);
    expect(g.warnings).toEqual([{ kind: 'complexJoin', walls: ['c', 'a', 'b'] }]);
    expectPolygon(g.pieces.get('c')![0]!.polygon, [[-0.05, 0], [0.05, 0], [0.05, 3], [-0.05, 3]]);
    // The passage still joins: one cut at x = 0.
    expectPolygon(g.pieces.get('a')![0]!.polygon, [[-4, -0.1], [0, -0.1], [0, 0.1], [-4, 0.1]]);
  });
});
