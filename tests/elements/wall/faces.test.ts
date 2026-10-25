// Faces de corte (spec §8): of the walls' 3D blocks only the outside is drawn. Where two blocks touch,
// side to side or one on another, the faces between them are inside the solid; drawn, the two
// coplanar faces fought for the same pixels and the walls showed light specks in 3D.

import { describe, expect, it } from 'vitest';
import { visibleFaces, type Prism } from '../../../src/elements/wall/geometry/faces';

const box = (x0: number, y0: number, x1: number, y1: number, bottom: number, top: number): Prism => ({
  polygon: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
  bottom,
  top,
});

describe('visible faces of touching blocks', () => {
  it('a lone block shows every face whole', () => {
    const [f] = visibleFaces([box(0, 0, 1, 0.2, 0, 2.8)]);
    expect(f!.sides.map((s) => s.length)).toEqual([1, 1, 1, 1]);
    expect(f!.sides[0]![0]).toEqual({ t0: 0, t1: 1, z0: 0, z1: 2.8 });
    expect(f!.top).toHaveLength(1);
    expect(f!.bottom).toHaveLength(1);
  });

  it('two blocks side by side: the faces between them are hidden, the others whole', () => {
    // Edge 1 of the first (x = 1) faces edge 3 of the second (x = 1).
    const [a, b] = visibleFaces([box(0, 0, 1, 0.2, 0, 2.8), box(1, 0, 2, 0.2, 0, 2.8)]);
    expect(a!.sides[1]).toEqual([]);
    expect(b!.sides[3]).toEqual([]);
    expect(a!.sides[0]).toHaveLength(1);
    expect(b!.sides[2]).toHaveLength(1);
  });

  it('a lower neighbour hides only the part of the end it stands against', () => {
    const [a] = visibleFaces([box(0, 0, 1, 0.2, 0, 2.8), box(1, 0, 2, 0.2, 0, 1.5)]);
    expect(a!.sides[1]).toEqual([{ t0: 0, t1: 0.2, z0: 1.5, z1: 2.8 }]);
  });

  it('one block on another: the top under and the bottom over are hidden', () => {
    const [low, high] = visibleFaces([box(0, 0, 1, 0.2, 0, 1), box(0, 0, 1, 0.2, 1, 2.8)]);
    expect(low!.top).toEqual([]);
    expect(high!.bottom).toEqual([]);
    expect(low!.bottom).toHaveLength(1);
    expect(high!.top).toHaveLength(1);
  });

  it('a shorter block beside: the face is hidden only where they overlap along it', () => {
    // The second covers x from 0.25 to 0.75 of the first's long side (y = 0.2).
    const [a] = visibleFaces([box(0, 0, 1, 0.2, 0, 2.8), box(0.25, 0.2, 0.75, 0.4, 0, 2.8)]);
    // Edge 2 runs from (1, 0.2) to (0, 0.2): t from 0 at x = 1.
    const rects = a!.sides[2]!.map((r) => [r.t0, r.t1].map((v) => Math.round(v * 1000) / 1000));
    expect(rects).toEqual([
      [0, 0.25],
      [0.75, 1],
    ]);
  });
});
