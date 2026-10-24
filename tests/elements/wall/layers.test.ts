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

  it('a flipped wall (exterior facing into the corner) meets the layers in reverse', () => {
    const flipped = testWall('b', vec(0, 0), vec(0, 3), plastered);
    const g = geometry([a, flipped]).pieces.get('b')!;
    // b drawn upward: left normal (−1, 0), so its exterior finish is x ∈ [0.08, 0.1].
    expectPolygon(g.find((p) => p.layerIndex === 0)!.polygon, [[0.08, 0.08], [0.1, 0.1], [0.1, 3], [0.08, 3]]);
  });

  it('different types: one miter for all layers, areas still add up', () => {
    const two = [layer(0.05, 'finish1'), layer(0.15, 'structure')];
    const walls = [testWall('a', vec(0, 0), vec(4, 0), 0.2), testWall('b', vec(0, 3), vec(0, 0), two)];
    const g = geometry(walls).pieces;
    expectPolygon(g.get('b')!.find((p) => p.layerIndex === 0)!.polygon, [
      [-0.1, -0.1],
      [-0.05, -0.05],
      [-0.05, 3],
      [-0.1, 3],
    ]);
    const total = [...g.values()].flat().reduce((s, p) => s + shoelace(p.polygon), 0);
    expect(total).toBeCloseTo(0.82 + 0.58, 12);
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

  it('the finishes stop on the host face (y = 0.1)', () => {
    expectPolygon(piecesOf('t', 0)[0]!, [[3.05, 0.1], [3.06, 0.1], [3.06, 2], [3.05, 2]]);
    expectPolygon(piecesOf('t', 2)[0]!, [[2.94, 0.1], [2.95, 0.1], [2.95, 2], [2.94, 2]]);
  });

  it('the host interior finish is notched exactly where the core passes', () => {
    const notched = piecesOf('host', 2);
    expect(notched).toHaveLength(2);
    expectPolygon(notched.find((p) => p.some((v) => v.x === 0))!, [[0, 0.07], [2.95, 0.07], [2.95, 0.1], [0, 0.1]]);
    expectPolygon(notched.find((p) => p.some((v) => v.x === 6))!, [[3.05, 0.07], [6, 0.07], [6, 0.1], [3.05, 0.1]]);
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

  it('a wall with both ends inside the host warns wallsOverlap and cuts nothing', () => {
    const stub = testWall('t', vec(3, -0.05), vec(3, 0.05), 0.1);
    const r = geometry([host, stub]);
    expect(r.warnings).toEqual([{ kind: 'wallsOverlap', walls: ['t', 'host'] }]);
    expect(r.pieces.get('host')!.filter((p) => p.layerIndex === 2)).toHaveLength(1);
  });
});
