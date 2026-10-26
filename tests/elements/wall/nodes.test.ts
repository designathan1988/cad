// Nodes with 3, 4 and 5+ ends (docs/wall-joins-spec.md §7.4, §7.6). Every expected value is worked out
// by hand.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import { geometry, layer, testWall } from './fixtures';
import { shoelace } from './oracle';
import { overlapArea } from '../../../src/elements/wall/geometry/convex';

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
  // No pair is within 10° of in line: every arm takes its sector (§7.6), cut on the lines to the
  // corners the faces make across each gap.
  //   a|c: a's face y = 0.15 and c's face at −0.05 along n_c = (−sin 30°, cos 30°), reached at t along
  //        c with −0.05·cos 30° + t·sin 30° = 0.15.
  //   c|b: c's face at +0.05 along n_c and b's face at +0.15 along m = (sin 20°, cos 20°), b's normal
  //        toward c: sin 20°·x + cos 20°·y = 0.15 and −sin 30°·x + cos 30°·y = 0.05, determinant sin 50°.
  //   b|a: b's face at −0.15 along m and a's face y = −0.15: x = −0.15·tan 10°.
  // Seen from the node, b's sector runs from the c|b corner (48°) round to the b|a corner (260°), more
  // than a half-turn: 30 cm beside 10 cm, the corners leave the node outside them. The lines then start
  // from the middle of the three corners, which lies inside all three walls.
  const r = Math.PI / 180;
  const sin = (deg: number) => Math.sin(deg * r);
  const cos = (deg: number) => Math.cos(deg * r);
  const walls = [
    testWall('a', vec(0, 0), vec(4, 0), 0.3),
    testWall('b', vec(0, 0), vec(4 * cos(160), 4 * sin(160)), 0.3),
    testWall('c', vec(0, 0), vec(3 * cos(30), 3 * sin(30)), 0.1),
  ];
  const g = geometry(walls);
  const t = (0.15 + 0.05 * cos(30)) / sin(30);
  const ac: XY = [0.05 * sin(30) + t * cos(30), 0.15];
  const cb: XY = [(0.15 * cos(30) - 0.05 * cos(20)) / sin(50), (0.05 * sin(20) + 0.15 * sin(30)) / sin(50)];
  const ba: XY = [-0.15 * Math.tan(10 * r), -0.15];
  const mid: XY = [(ac[0] + cb[0] + ba[0]) / 3, (ac[1] + cb[1] + ba[1]) / 3];

  it('joins without a warning, one piece each', () => {
    expect(g.warnings).toEqual([]);
    for (const w of walls) expect(g.pieces.get(w.id)).toHaveLength(1);
  });

  it('each wall is cut on the lines from the middle to its two corners', () => {
    expectPolygon(g.pieces.get('a')![0]!.polygon, [[4, -0.15], [4, 0.15], ac, mid, ba]);
    const farB = (o: number): XY => [4 * cos(160) + o * sin(20), 4 * sin(160) + o * cos(20)];
    expectPolygon(g.pieces.get('b')![0]!.polygon, [farB(0.15), cb, mid, ba, farB(-0.15)]);
    const farC = (o: number): XY => [3 * cos(30) - o * sin(30), 3 * sin(30) + o * cos(30)];
    expectPolygon(g.pieces.get('c')![0]!.polygon, [ac, farC(-0.05), farC(0.05), cb, mid]);
  });

  it('no two pieces overlap', () => {
    const [a, b, c] = walls.map((w) => g.pieces.get(w.id)![0]!.polygon);
    expect(overlapArea(a!, b!)).toBeLessThan(1e-9);
    expect(overlapArea(b!, c!)).toBeLessThan(1e-9);
    expect(overlapArea(c!, a!)).toBeLessThan(1e-9);
  });
});

describe('5 ends, and an end across a step', () => {
  it('five ends at one point: each arm cut from the node to the corners beside it, no warning', () => {
    // 10 cm walls 72° apart. Neighbours' faces meet on the bisector between them, 0.05/sin 36° from
    // the node, which lies inside all five corners (§7.6). Before, five ends warned complexJoin and
    // stayed square, overlapping.
    const r = Math.PI / 180;
    const walls = [0, 72, 144, 216, 288].map((deg, i) =>
      testWall(`w${i}`, vec(0, 0), vec(3 * Math.cos(deg * r), 3 * Math.sin(deg * r)), 0.1),
    );
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    const at = (deg: number, len: number): XY => [len * Math.cos(deg * r), len * Math.sin(deg * r)];
    const d = 0.05 / Math.sin(36 * r);
    walls.forEach((w, i) => {
      const deg = 72 * i;
      const far = (o: number): XY => [at(deg, 3)[0] + at(deg + 90, o)[0], at(deg, 3)[1] + at(deg + 90, o)[1]];
      expect(g.pieces.get(w.id)).toHaveLength(1);
      expectPolygon(g.pieces.get(w.id)![0]!.polygon, [[0, 0], at(deg - 36, d), far(-0.05), far(0.05), at(deg + 36, d)]);
    });
    const polys = walls.map((w) => g.pieces.get(w.id)![0]!.polygon);
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) expect(overlapArea(polys[i]!, polys[j]!)).toBeLessThan(1e-9);
    }
  });

  it('an end straddling a passage whose walls differ there takes its sector: corners above, the step below', () => {
    // a 20 cm and b 30 cm in line along x, both on the axis: their faces step at x = 0. c, 10 cm,
    // leaves upward across the step, so it fits neither only against a nor against matching faces (it
    // warned complexJoin and stayed square). Its sector (§7.6): c's faces meet a's face y = 0.1 at
    // (−0.05, 0.1) and b's face y = 0.15 at (0.05, 0.15); below, a and b in line split on x = 0.
    const walls = [
      testWall('a', vec(-4, 0), vec(0, 0), 0.2),
      testWall('b', vec(0, 0), vec(4, 0), 0.3),
      testWall('c', vec(0, 0), vec(0, 3), 0.1),
    ];
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    expectPolygon(g.pieces.get('c')![0]!.polygon, [[0, 0], [0.05, 0.15], [0.05, 3], [-0.05, 3], [-0.05, 0.1]]);
    expectPolygon(g.pieces.get('a')![0]!.polygon, [[-4, -0.1], [0, -0.1], [0, 0], [-0.05, 0.1], [-4, 0.1]]);
    expectPolygon(g.pieces.get('b')![0]!.polygon, [[0, -0.15], [4, -0.15], [4, 0.15], [0.05, 0.15], [0, 0]]);
    // The union of the three bands: a 4 × 0.2, b 4 × 0.3, and c's 3 × 0.1 less what lies inside a
    // (0.05 × 0.1) and inside b (0.05 × 0.15). Nothing overlaps, nothing is left open.
    const total = [...g.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(0.8 + 1.2 + (0.3 - 0.005 - 0.0075), 12);
  });
});

describe('node: an arc from the outside of an L corner', () => {
  // The outer corner of a 26.5 cm house wall, (10, 8): the arc starts there and leaves to the
  // upper right, bending down (a curved porch). Its end segments are 10 cm long: the first few still
  // lie in the corner. Refused before (complexJoin, then "join with an arc not supported").
  const ext = [layer(0.015, 'finish1'), layer(0.22, 'structure'), layer(0.015, 'thermal'), layer(0.015, 'finish2')];
  const m15 = [layer(0.015, 'finish1'), layer(0.12, 'structure'), layer(0.015, 'finish2')];
  const walls = [
    testWall('w0', vec(0, 0), vec(10, 0), ext),
    testWall('w1', vec(10, 0), vec(10, 8), ext),
    testWall('w2', vec(10, 8), vec(0, 8), ext),
    testWall('w3', vec(0, 8), vec(0, 0), ext),
    { ...testWall('arc', vec(10, 8), vec(13.5396, 4.60589), m15), bulge: -0.6495 },
  ];
  const g = geometry(walls);

  it('joins without a warning', () => {
    expect(g.warnings).toEqual([]);
  });

  it('no piece of the arc overlaps the corner walls, and it starts on their outer faces', () => {
    const arc = g.pieces.get('arc')!;
    for (const id of ['w1', 'w2']) {
      for (const p of g.pieces.get(id)!) for (const a of arc) expect(overlapArea(a.polygon, p.polygon)).toBeLessThan(1e-9);
    }
    // Outer faces x = 10.1325 (w1) and y = 8.1325 (w2): nothing of the arc lies inside both.
    const inCorner = arc.flatMap((a) => a.polygon).filter((v) => v.x < 10.1325 - 1e-9 && v.y < 8.1325 - 1e-9);
    expect(inCorner).toEqual([]);
    // And it reaches them: some of its vertices lie on one of those faces.
    expect(arc.flatMap((a) => a.polygon).some((v) => Math.abs(v.x - 10.1325) < 1e-9 || Math.abs(v.y - 8.1325) < 1e-9)).toBe(true);
  });
});

