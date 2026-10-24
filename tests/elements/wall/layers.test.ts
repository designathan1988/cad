// Layers, core and type problems. Every expected value below is worked out by hand.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import { shapeOf } from '../../../src/elements/wall/geometry/shape';
import type { Wall, WallType } from '../../../src/elements/wall/schema';
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

// 20 cm: 2 cm exterior finish, 15 cm structure, 3 cm interior finish.
const plastered = [layer(0.02, 'finish1'), layer(0.15, 'structure'), layer(0.03, 'finish2')];

describe('layered L corner', () => {
  // Drawn as part of a counter-clockwise room: b comes down to the corner, a leaves along +x.
  // Both exteriors face out of the corner, so layer k meets layer k on the miter y = x.
  const a = testWall('a', vec(0, 0), vec(4, 0), plastered);
  const b = testWall('b', vec(0, 3), vec(0, 0), plastered);
  const pieces = geometry([a, b]).pieces;
  const layerOf = (id: string, k: number) => pieces.get(id)!.find((p) => p.layerIndex === k)!.polygon;

  it('a: each layer is its band, cut on the miter', () => {
    expectPolygon(layerOf('a', 0), [[-0.1, -0.1], [4, -0.1], [4, -0.08], [-0.08, -0.08]]);
    expectPolygon(layerOf('a', 1), [[-0.08, -0.08], [4, -0.08], [4, 0.07], [0.07, 0.07]]);
    expectPolygon(layerOf('a', 2), [[0.07, 0.07], [4, 0.07], [4, 0.1], [0.1, 0.1]]);
  });

  it('b: layer k shares the miter segment with layer k of a', () => {
    expectPolygon(layerOf('b', 0), [[-0.1, -0.1], [-0.08, -0.08], [-0.08, 3], [-0.1, 3]]);
    expectPolygon(layerOf('b', 1), [[-0.08, -0.08], [0.07, 0.07], [0.07, 3], [-0.08, 3]]);
    expectPolygon(layerOf('b', 2), [[0.07, 0.07], [0.1, 0.1], [0.1, 3], [0.07, 3]]);
  });

  it('a flipped wall reads its layers in reverse from the corner: not the same sequence, so butt', () => {
    // b drawn upward: left normal (−1, 0), exterior finish x ∈ [0.08, 0.1], core x ∈ [−0.07, 0.08],
    // interior finish x ∈ [−0.1, −0.07]. Equal cores: a (lower id) goes through, cut on b's outer face
    // x = −0.1; b abuts a from +y, where a shows its finish 2 (y ∈ [0.07, 0.1]).
    const flipped = testWall('b', vec(0, 0), vec(0, 3), plastered);
    const g = geometry([a, flipped]).pieces;
    const of = (id: string, k: number) => g.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);
    expectPolygon(of('a', 0)[0]!, [[-0.1, -0.1], [4, -0.1], [4, -0.08], [-0.1, -0.08]]);
    expectPolygon(of('a', 1)[0]!, [[-0.1, -0.08], [4, -0.08], [4, 0.07], [-0.1, 0.07]]);
    // Finish 1 of b (4) passes finish 2 of a (5) to a's core; finish 2 of b stops on the face.
    expectPolygon(of('b', 0)[0]!, [[0.08, 0.07], [0.1, 0.07], [0.1, 3], [0.08, 3]]);
    expectPolygon(of('b', 1)[0]!, [[-0.07, 0.07], [0.08, 0.07], [0.08, 3], [-0.07, 3]]);
    expectPolygon(of('b', 2)[0]!, [[-0.1, 0.1], [-0.07, 0.1], [-0.07, 3], [-0.1, 3]]);
    // Finish 2 of a is notched where b's finish 1 and core pass: x ∈ [−0.07, 0.1].
    const f2 = of('a', 2);
    expect(f2).toHaveLength(2);
    const at = (x: number) => f2.find((p) => p.some((v) => Math.abs(v.x - x) < 1e-12))!;
    expectPolygon(at(4), [[0.1, 0.07], [4, 0.07], [4, 0.1], [0.1, 0.1]]);
    expectPolygon(at(-0.1), [[-0.1, 0.07], [-0.07, 0.07], [-0.07, 0.1], [-0.1, 0.1]]);
    const total = [...g.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(0.82 + 0.58, 12);
  });

  it('different types butt: the thicker core goes through to the outer face of the other', () => {
    // a: 20 cm structure, y ∈ [−0.1, 0.1]. b drawn down: finish 1 x ∈ [−0.1, −0.05], structure
    // x ∈ [−0.05, 0.1]. Cores 0.2 and 0.15: a goes through, cut on b's outer face x = −0.1; b stops on
    // a's face y = 0.1, which is a's core face too.
    const two = [layer(0.05, 'finish1'), layer(0.15, 'structure')];
    const walls = [testWall('a', vec(0, 0), vec(4, 0), 0.2), testWall('b', vec(0, 3), vec(0, 0), two)];
    const g = geometry(walls).pieces;
    expectPolygon(g.get('a')![0]!.polygon, [[-0.1, -0.1], [4, -0.1], [4, 0.1], [-0.1, 0.1]]);
    expectPolygon(g.get('b')!.find((p) => p.layerIndex === 0)!.polygon, [[-0.1, 0.1], [-0.05, 0.1], [-0.05, 3], [-0.1, 3]]);
    expectPolygon(g.get('b')!.find((p) => p.layerIndex === 1)!.polygon, [[-0.05, 0.1], [0.1, 0.1], [0.1, 3], [-0.05, 3]]);
    const total = [...g.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(0.82 + 0.58, 12);
  });

  it('butt with finishes: the abutting wall follows the T priority rule against the through wall', () => {
    // a: plastered, through (core 15 cm against 10 cm). b drawn down: finish 1 x ∈ [−0.06, −0.05],
    // structure x ∈ [−0.05, 0.05], finish 2 x ∈ [0.05, 0.06]; its outer face is x = −0.06.
    const thin = [layer(0.01, 'finish1'), layer(0.1, 'structure'), layer(0.01, 'finish2')];
    const g = geometry([a, testWall('b', vec(0, 3), vec(0, 0), thin)]).pieces;
    const of = (id: string, k: number) => g.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);
    expectPolygon(of('a', 0)[0]!, [[-0.06, -0.1], [4, -0.1], [4, -0.08], [-0.06, -0.08]]);
    expectPolygon(of('a', 1)[0]!, [[-0.06, -0.08], [4, -0.08], [4, 0.07], [-0.06, 0.07]]);
    expect(of('a', 2)).toHaveLength(1);
    expectPolygon(of('a', 2)[0]!, [[0.05, 0.07], [4, 0.07], [4, 0.1], [0.05, 0.1]]);
    expectPolygon(of('b', 0)[0]!, [[-0.06, 0.07], [-0.05, 0.07], [-0.05, 3], [-0.06, 3]]);
    expectPolygon(of('b', 1)[0]!, [[-0.05, 0.07], [0.05, 0.07], [0.05, 3], [-0.05, 3]]);
    expectPolygon(of('b', 2)[0]!, [[0.05, 0.1], [0.06, 0.1], [0.06, 3], [0.05, 3]]);
    const total = [...g.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(4.06 * 0.2 + 0.12 * 2.9, 12);
  });

  it('butt whose through corner lands past the short wall free end warns wallsOverlap', () => {
    // a: 40 cm along +x, y ∈ [−0.2, 0.2], goes through. b: 10 cm, 0.3 m long, leaving the node at 135°;
    // u = (−c, c), c = √2/2, left normal (−c, −c), its outer face (away from a's body) at offset +0.05.
    // Along u: the miter's inner corner (b inner face ∩ y = 0.2) is at t = (0.2 − 0.05c)/c ≈ 0.233 and
    // the outer corner is behind the node, both short of b's far end at 0.3, so a miter would hold. The
    // butt's own corner, a's inner face ∩ b's outer face, is at t = (0.2 + 0.05c)/c ≈ 0.333: past the
    // far end. a's square end would swallow b.
    const c = Math.SQRT1_2;
    const b = testWall('b', vec(-0.3 * c, 0.3 * c), vec(0, 0), [layer(0.1, 'structure')]);
    const g = geometry([testWall('a', vec(0, 0), vec(4, 0), 0.4), b]);
    expect(g.warnings).toEqual([{ kind: 'wallsOverlap', walls: ['a', 'b'] }]);
  });

  it('butt whose abutting layer would reach past the through wall free end warns wallsOverlap', () => {
    // a: plastered on its axis, 2 cm long, from (0.02, 0) back to the node; its left normal is (0, −1),
    // so finish 1 is y ∈ [0.08, 0.1] and its core face on that side is y = 0.08. b: finish 2 1 cm,
    // structure 10 cm, thermal 1 cm, leaving the node at 120°, so its face toward a's body is offset
    // +0.06 (normal (√3/2, 1/2)). a goes through (core 15 cm against 10).
    // Miter corners: inner (y = 0.1 on b's +0.06 face) at x = 0.01155, outer behind the node: inside a.
    // Butt corner (y = 0.1 on b's −0.06 face): x = −0.127, behind the node.
    // But b's thermal layer (3) passes a's finish 1 (4) to y = 0.08, where its +0.06 edge is at
    // x = 0.0231: past a's free end at 0.02. a's end would swallow it.
    const ls = [layer(0.01, 'finish2'), layer(0.1, 'structure'), layer(0.01, 'thermal')];
    const u = vec(Math.cos((2 * Math.PI) / 3), Math.sin((2 * Math.PI) / 3));
    const b = testWall('b', vec(2 * u.x, 2 * u.y), vec(0, 0), ls);
    const g = geometry([testWall('a', vec(0.02, 0), vec(0, 0), plastered), b]);
    expect(g.warnings).toEqual([{ kind: 'wallsOverlap', walls: ['a', 'b'] }]);
  });

  it('the same with a 3 cm wall: every point stays inside, so it butts', () => {
    const ls = [layer(0.01, 'finish2'), layer(0.1, 'structure'), layer(0.01, 'thermal')];
    const u = vec(Math.cos((2 * Math.PI) / 3), Math.sin((2 * Math.PI) / 3));
    const g = geometry([testWall('a', vec(0.03, 0), vec(0, 0), plastered), testWall('b', vec(2 * u.x, 2 * u.y), vec(0, 0), ls)]);
    expect(g.warnings).toEqual([]);
    // The thermal layer stops on a's core face y = 0.08.
    const thermal = g.pieces.get('b')!.find((p) => p.layerIndex === 2)!.polygon;
    expect(Math.min(...thermal.map((v) => v.y))).toBeCloseTo(0.08, 14);
  });

  it('butt nearly in line: its own corner more than 10 T from the node, so one shared cut', () => {
    // a: 10 cm structure along +x, through (core 10 cm against 8). b: finish 1, structure, finish 2,
    // 10 cm, a different sequence, leaving the node at 178°. The miter corners are 0.87 mm from the
    // node, but the butt's corner, a's inner face y = 0.05 on b's outer face, is at (−2.8645, 0.05),
    // 2.86 m away: past 10 · 0.1 m, so one shared cut through the node, as for walls in line. It runs
    // across the mean direction ua − ub = (1 + cos 2°, −sin 2°).
    const r = (2 * Math.PI) / 180;
    const ls = [layer(0.01, 'finish1'), layer(0.08, 'structure'), layer(0.01, 'finish2')];
    const g = geometry([testWall('a', vec(0, 0), vec(4, 0), 0.1), testWall('b', vec(0, 0), vec(-4 * Math.cos(r), 4 * Math.sin(r)), ls)]);
    expect(g.warnings).toEqual([]);
    const across = vec(Math.cos(r / 2), -Math.sin(r / 2));
    const reach = g.pieces.get('a')!.flatMap((p) => p.polygon).map((v) => v.x * across.x + v.y * across.y);
    expect(Math.min(...reach)).toBeGreaterThanOrEqual(-1e-15);
  });

  it('same functions, thicknesses within 1 mm: still the same sequence, so a miter', () => {
    const near = [layer(0.0205, 'finish1'), layer(0.15, 'structure'), layer(0.03, 'finish2')];
    const g = geometry([a, testWall('b', vec(0, 3), vec(0, 0), near)]).pieces;
    // A miter cuts a on the diagonal: no vertex of a reaches x below −0.1, and a has a vertex inside
    // the corner square on its inner face, which a butt would not.
    expect(g.get('a')!.some((p) => p.polygon.some((v) => v.y === 0.1 && v.x > 0))).toBe(true);
  });
});

describe('derived shape', () => {
  const wall: Wall = { id: 'w', wallTypeId: 't', start: vec(0, 0), end: vec(1, 0), referenceLine: 'centerline' };
  const typeOf = (layers: WallType['layers']): WallType => ({ id: 't', name: 't', layers });

  it('thickness is the sum of the layers and the core spans first to last structure layer', () => {
    const s = shapeOf(
      wall,
      typeOf([
        layer(0.02, 'finish1'),
        layer(0.1, 'structure'),
        layer(0.05, 'thermal'),
        layer(0.1, 'structure'),
        layer(0.02, 'finish2'),
      ]),
    );
    if (typeof s === 'string') throw new Error(s);
    expect(s.thickness).toBeCloseTo(0.29, 15);
    [-0.145, -0.125, -0.025, 0.025, 0.125, 0.145].forEach((o, i) => expect(s.layerOffsets[i]).toBeCloseTo(o, 15));
    expect(s.core[0]).toBeCloseTo(-0.125, 15);
    expect(s.core[1]).toBeCloseTo(0.125, 15);
  });

  it('without a structure layer the core is the whole wall', () => {
    const s = shapeOf(
      { ...wall, referenceLine: 'exteriorFace' },
      typeOf([layer(0.1, 'finish1'), layer(0.1, 'thermal')]),
    );
    if (typeof s === 'string') throw new Error(s);
    expect(s.core).toEqual([0, 0.2]);
  });

  it('rejects a missing type, an empty type and a layer without thickness', () => {
    expect(shapeOf(wall, undefined)).toBe('missingWallType');
    expect(shapeOf(wall, typeOf([]))).toBe('invalidWallType');
    expect(shapeOf(wall, typeOf([layer(0.1), layer(0)]))).toBe('invalidWallType');
    expect(shapeOf(wall, typeOf([layer(Number.NaN)]))).toBe('invalidWallType');
  });

  it('a wall with a bad type warns, draws nothing, and does not stop the others', () => {
    const ok: Wall = { id: 'ok', wallTypeId: 'good', start: vec(0, 0), end: vec(4, 0), referenceLine: 'centerline' };
    const lost: Wall = { ...ok, id: 'lost', wallTypeId: 'nowhere', start: vec(0, 2), end: vec(4, 2) };
    const types = new Map([['good', { id: 'good', name: 'good', layers: [layer(0.2)] }]]);
    const g = computeWallGeometry([ok, lost], types);
    expect(g.warnings).toEqual([{ kind: 'missingWallType', walls: ['lost'] }]);
    expect(g.pieces.get('lost')).toEqual([]);
    expect(g.pieces.get('ok')).toHaveLength(1);
  });
});

describe('layered T', () => {
  // Host: 2 cm exterior finish, 15 cm structure, 3 cm interior finish, on its axis: y from −0.1 to 0.1,
  // core y ∈ [−0.08, 0.07]. Abutting from (3, 0) upward: 1 cm finish, 10 cm structure, 1 cm finish,
  // so x ∈ [3.05, 3.06] (exterior, on its right), core x ∈ [2.95, 3.05], interior x ∈ [2.94, 2.95].
  const host = testWall('host', vec(0, 0), vec(6, 0), plastered);
  const thin = [layer(0.01, 'finish1'), layer(0.1, 'structure'), layer(0.01, 'finish2')];
  const t = testWall('t', vec(3, 0), vec(3, 2), thin);
  const g = geometry([host, t]).pieces;
  const piecesOf = (id: string, k: number) => g.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);

  it('the core runs to the host core face (y = 0.07)', () => {
    expectPolygon(piecesOf('t', 1)[0]!, [[2.95, 0.07], [3.05, 0.07], [3.05, 2], [2.95, 2]]);
  });

  it('finish 1 (priority 4) passes the host finish 2 (priority 5) and stops on the host core (y = 0.07)', () => {
    expectPolygon(piecesOf('t', 0)[0]!, [[3.05, 0.07], [3.06, 0.07], [3.06, 2], [3.05, 2]]);
  });

  it('finish 2 meets the host finish 2, same priority: it stops on the host face (y = 0.1)', () => {
    expectPolygon(piecesOf('t', 2)[0]!, [[2.94, 0.1], [2.95, 0.1], [2.95, 2], [2.94, 2]]);
  });

  it('the host interior finish is notched exactly where the core and finish 1 pass', () => {
    const notched = piecesOf('host', 2);
    expect(notched).toHaveLength(2);
    expectPolygon(notched.find((p) => p.some((v) => v.x === 0))!, [[0, 0.07], [2.95, 0.07], [2.95, 0.1], [0, 0.1]]);
    expectPolygon(notched.find((p) => p.some((v) => v.x === 6))!, [[3.06, 0.07], [6, 0.07], [6, 0.1], [3.06, 0.1]]);
  });

  it('the host core and exterior finish are untouched', () => {
    expectPolygon(piecesOf('host', 0)[0]!, [[0, -0.1], [6, -0.1], [6, -0.08], [0, -0.08]]);
    expectPolygon(piecesOf('host', 1)[0]!, [[0, -0.08], [6, -0.08], [6, 0.07], [0, 0.07]]);
  });

  it('the total area is the host plus the abutting wall beyond the face: 1.2 + 0.12 · 1.9', () => {
    const total = [...g.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1.428, 12);
  });

  it('a wall without structure is all core: the whole of it runs to the host core face', () => {
    const soft = testWall('t', vec(3, 0), vec(3, 2), [layer(0.05, 'finish1'), layer(0.05, 'thermal')]);
    const ys = geometry([host, soft]).pieces.get('t')!.flatMap((p) => p.polygon.map((v) => v.y));
    expect(Math.min(...ys)).toBeCloseTo(0.07, 15);
  });

  it('a layer passes lower priorities and stops at the first host layer of equal or higher priority', () => {
    // Host from its exterior: finish 1 2 cm, structure 15 cm, substrate 2 cm, finish 2 1 cm, so
    // y ∈ [−0.1, −0.08], [−0.08, 0.07], [0.07, 0.09], [0.09, 0.1]. Abutting: thermal 2 cm (x ∈ [3.05, 3.07]),
    // structure 10 cm (x ∈ [2.95, 3.05]), finish 2 2 cm (x ∈ [2.93, 2.95]).
    const h = testWall('host', vec(0, 0), vec(6, 0), [
      layer(0.02, 'finish1'),
      layer(0.15, 'structure'),
      layer(0.02, 'substrate'),
      layer(0.01, 'finish2'),
    ]);
    const a = testWall('t', vec(3, 0), vec(3, 2), [layer(0.02, 'thermal'), layer(0.1, 'structure'), layer(0.02, 'finish2')]);
    const r = geometry([h, a]).pieces;
    const of = (id: string, k: number) => r.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);
    // Thermal (3) passes finish 2 (5) and stops on the substrate (2).
    expectPolygon(of('t', 0)[0]!, [[3.05, 0.09], [3.07, 0.09], [3.07, 2], [3.05, 2]]);
    expectPolygon(of('t', 1)[0]!, [[2.95, 0.07], [3.05, 0.07], [3.05, 2], [2.95, 2]]);
    expectPolygon(of('t', 2)[0]!, [[2.93, 0.1], [2.95, 0.1], [2.95, 2], [2.93, 2]]);
    // Finish 2 of the host gives way to the core and the thermal layer; the substrate only to the core.
    const f2 = of('host', 3);
    expect(f2).toHaveLength(2);
    expectPolygon(f2.find((p) => p.some((v) => v.x === 6))!, [[3.07, 0.09], [6, 0.09], [6, 0.1], [3.07, 0.1]]);
    const sub = of('host', 2);
    expect(sub).toHaveLength(2);
    expectPolygon(sub.find((p) => p.some((v) => v.x === 6))!, [[3.05, 0.07], [6, 0.07], [6, 0.09], [3.05, 0.09]]);
    const total = [...r.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1.2 + 0.14 * 1.9, 12);
  });

  it('layers that pass need not be adjacent: the host keeps a piece between them', () => {
    // Abutting: thermal x ∈ [3.05, 3.07], finish 2 x ∈ [3.03, 3.05], structure x ∈ [2.93, 3.03].
    const a = testWall('t', vec(3, 0), vec(3, 2), [layer(0.02, 'thermal'), layer(0.02, 'finish2'), layer(0.1, 'structure')]);
    const r = geometry([host, a]).pieces;
    const f2 = r.get('host')!.filter((p) => p.layerIndex === 2).map((p) => p.polygon);
    expect(f2).toHaveLength(3);
    expectPolygon(f2.find((p) => p.some((v) => v.x === 3.03) && p.some((v) => v.x === 3.05))!, [
      [3.03, 0.07],
      [3.05, 0.07],
      [3.05, 0.1],
      [3.03, 0.1],
    ]);
    const tl = (k: number) => r.get('t')!.find((p) => p.layerIndex === k)!.polygon;
    expectPolygon(tl(0), [[3.05, 0.07], [3.07, 0.07], [3.07, 2], [3.05, 2]]);
    expectPolygon(tl(1), [[3.03, 0.1], [3.05, 0.1], [3.05, 2], [3.03, 2]]);
  });

  it('a wall with both ends inside the host warns wallsOverlap and cuts nothing', () => {
    const stub = testWall('t', vec(3, -0.05), vec(3, 0.05), 0.1);
    const r = geometry([host, stub]);
    expect(r.warnings).toEqual([{ kind: 'wallsOverlap', walls: ['t', 'host'] }]);
    expect(r.pieces.get('host')!.filter((p) => p.layerIndex === 2)).toHaveLength(1);
  });
});

describe('X crossing', () => {
  // a: the plastered 20 cm wall along y = 0 (core 15 cm, y ∈ [−0.08, 0.07]).
  // b: the 12 cm wall (core 10 cm) along x = 3, from y = −2 to 2. The thicker core, a, goes through.
  const a = testWall('a', vec(0, 0), vec(6, 0), plastered);
  const thin = [layer(0.01, 'finish1'), layer(0.1, 'structure'), layer(0.01, 'finish2')];
  const b = testWall('b', vec(3, -2), vec(3, 2), thin);
  const g = geometry([a, b]);
  const layerOf = (id: string, k: number) => g.pieces.get(id)!.filter((p) => p.layerIndex === k).map((p) => p.polygon);
  const below = (ps: ReturnType<typeof layerOf>) => ps.find((p) => p.every((v) => v.y <= 0))!;
  const above = (ps: ReturnType<typeof layerOf>) => ps.find((p) => p.every((v) => v.y >= 0))!;

  it('b is split; on each side its core runs to the core face of a', () => {
    const core = layerOf('b', 1);
    expect(core).toHaveLength(2);
    expectPolygon(below(core), [[2.95, -2], [3.05, -2], [3.05, -0.08], [2.95, -0.08]]);
    expectPolygon(above(core), [[2.95, 0.07], [3.05, 0.07], [3.05, 2], [2.95, 2]]);
  });

  it('finish 1 of b stops on finish 1 of a below, and passes finish 2 of a above', () => {
    const ext = layerOf('b', 0);
    expectPolygon(below(ext), [[3.05, -2], [3.06, -2], [3.06, -0.1], [3.05, -0.1]]);
    expectPolygon(above(ext), [[3.05, 0.07], [3.06, 0.07], [3.06, 2], [3.05, 2]]);
  });

  it('finish 2 of b stops on the faces of a on both sides', () => {
    const int = layerOf('b', 2);
    expectPolygon(below(int), [[2.94, -2], [2.95, -2], [2.95, -0.1], [2.94, -0.1]]);
    expectPolygon(above(int), [[2.94, 0.1], [2.95, 0.1], [2.95, 2], [2.94, 2]]);
  });

  it('a is notched on both sides where the core of b passes, and its core is untouched', () => {
    expect(layerOf('a', 0)).toHaveLength(2);
    expect(layerOf('a', 2)).toHaveLength(2);
    expectPolygon(layerOf('a', 1)[0]!, [[0, -0.08], [6, -0.08], [6, 0.07], [0, 0.07]]);
    expect(layerOf('a', 0).some((p) => p.some((v) => v.x === 2.95))).toBe(true);
  });

  it('the area is both walls minus their overlap: 1.2 + 0.48 − 0.12 · 0.2', () => {
    const total = [...g.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1.656, 12);
    expect(g.warnings).toEqual([]);
  });

  it('the thicker core goes through whatever the ids', () => {
    const swapped = geometry([testWall('z', vec(0, 0), vec(6, 0), plastered), testWall('b', vec(3, -2), vec(3, 2), thin)]);
    expect(swapped.pieces.get('z')!.filter((p) => p.layerIndex === 1)).toHaveLength(1);
    expect(swapped.pieces.get('b')!.filter((p) => p.layerIndex === 1)).toHaveLength(2);
  });

  it('equal cores: the lower id goes through', () => {
    const r = geometry([testWall('b', vec(0, 0), vec(6, 0), 0.2), testWall('a', vec(3, -2), vec(3, 2), 0.2)]);
    expect(r.pieces.get('a')).toHaveLength(1);
    expect(r.pieces.get('b')).toHaveLength(2);
  });

  it('a wall crossed twice is split into three spans, in order along it', () => {
    // Discovery meets a (x = 7) before b (x = 3): the spans must still follow the wall.
    const long = testWall('c', vec(0, 0), vec(10, 0), 0.1);
    const r = geometry([long, testWall('a', vec(7, -2), vec(7, 2), 0.2), testWall('b', vec(3, -2), vec(3, 2), 0.2)]);
    expect(r.pieces.get('c')).toHaveLength(3);
    const total = [...r.pieces.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(1 + 0.8 + 0.8 - 2 * 0.2 * 0.1, 12);
  });

  it('an end inside the other band is a T, not a crossing', () => {
    const r = geometry([a, testWall('t', vec(3, -2), vec(3, 0.05), thin)]);
    expect(r.pieces.get('t')!.filter((p) => p.layerIndex === 1)).toHaveLength(1);
  });

  it('the same, with the abutting wall first in id order and its end past the host core', () => {
    // The end (y = 0.09) sits in the host's interior finish. Read as a crossing as well, the far side
    // would notch that finish where no core arrives and leave a gap.
    const host = testWall('z', vec(0, 0), vec(6, 0), plastered);
    const r = geometry([host, testWall('a', vec(3, -2), vec(3, 0.09), thin)]);
    expect(r.pieces.get('a')!.filter((p) => p.layerIndex === 1)).toHaveLength(1);
    expect(r.pieces.get('z')!.filter((p) => p.layerIndex === 2)).toHaveLength(1);
    expect(r.pieces.get('z')!.filter((p) => p.layerIndex === 0)).toHaveLength(2);
  });

  it('one type on two reference lines ties exactly: the lower id goes through', () => {
    // Regression: 2 + 12 + 1 cm gives a core of 0.11999999999999998 by offset difference on the
    // exterior face and 0.12 on the interior face; the type is the same, so it must tie.
    const ls = [layer(0.02, 'finish1'), layer(0.12, 'structure'), layer(0.01, 'finish2')];
    const r = geometry([
      testWall('a', vec(0, 0), vec(6, 0), ls, 'exteriorFace'),
      testWall('b', vec(3, -2), vec(3, 2), ls, 'interiorFace'),
    ]);
    expect(r.pieces.get('a')!.filter((p) => p.layerIndex === 1)).toHaveLength(1);
    expect(r.pieces.get('b')!.filter((p) => p.layerIndex === 1)).toHaveLength(2);
  });

  it('cores less than 1 mm apart tie: the lower id goes through, not the 0.5 mm thicker one', () => {
    const r = geometry([testWall('a', vec(0, 0), vec(6, 0), 0.12), testWall('b', vec(3, -2), vec(3, 2), 0.1205)]);
    expect(r.pieces.get('a')).toHaveLength(1);
    expect(r.pieces.get('b')).toHaveLength(2);
  });
});
