// Lines between layers in plan (the tester's D5): drawn where pieces of different layers meet, so the
// layers do not depend on colour alone (ref/chat.txt:245); none between pieces of the same layer and
// material, as Revit cleans joins up.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/app/document';
import { deriveGeometry } from '../../../src/app/geometry';
import { layerSeams } from '../../../src/elements/wall/geometry/seams';

const sq = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
const length = (s: { a: { x: number; y: number }; b: { x: number; y: number } }) => Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);

describe('layerSeams, by hand', () => {
  it('two pieces of different layers sharing a side: one line, that side', () => {
    const seams = layerSeams([
      { wallId: 'w', polygon: sq(0, 0, 4, 0.1), key: 'finish' },
      { wallId: 'w', polygon: sq(0, 0.1, 4, 0.3), key: 'core' },
    ]);
    // A seam has no direction: its two ends, in either order.
    const [only, ...more] = seams.get('w')!;
    expect(more).toEqual([]);
    expect([only!.a, only!.b].sort((p, q) => p.x - q.x)).toEqual([{ x: 0, y: 0.1 }, { x: 4, y: 0.1 }]);
  });

  it('the same layer on both sides: no line', () => {
    expect(layerSeams([
      { wallId: 'w', polygon: sq(0, 0, 2, 0.2), key: 'core' },
      { wallId: 'w', polygon: sq(2, 0, 4, 0.2), key: 'core' },
    ]).size).toBe(0);
  });

  it('sides that overlap only in part: the line is the shared part', () => {
    const seams = layerSeams([
      { wallId: 'w', polygon: sq(0, 0, 4, 0.1), key: 'finish' },
      { wallId: 'w', polygon: sq(1, 0.1, 3, 0.3), key: 'core' },
    ]);
    const [s] = seams.get('w')!;
    expect(length(s!)).toBeCloseTo(2, 12);
  });

  it('pieces that only touch at a corner, or lie apart: no line', () => {
    expect(layerSeams([
      { wallId: 'w', polygon: sq(0, 0, 1, 1), key: 'a' },
      { wallId: 'w', polygon: sq(1, 1, 2, 2), key: 'b' },
      { wallId: 'w', polygon: sq(5, 5, 6, 6), key: 'c' },
    ]).size).toBe(0);
  });
});

describe('seams of real walls', () => {
  const wall = (id: string, a: [number, number], b: [number, number], type: string): DocWall => ({
    id,
    wallTypeId: type,
    start: { x: a[0], y: a[1] },
    end: { x: b[0], y: b[1] },
    referenceLine: 'centerline',
    levelId: 'lvl_ground',
  });

  it('a 4 m wall of a three-layer type: two lines along it, each 4 m', () => {
    const d: Doc = { ...newDocument(), walls: [wall('a', [0, 0], [4, 0], 'wt_masonry15')] };
    const type = d.wallTypes.find((t) => t.id === 'wt_masonry15')!;
    const seams = deriveGeometry(d).solids.get('a')!.seams;
    expect(seams).toHaveLength(type.layers.length - 1);
    for (const s of seams) {
      expect(length(s)).toBeCloseTo(4, 9);
      expect(s.a.y).toBeCloseTo(s.b.y, 12);
    }
  });

  it('the solid knows its layers, for their colours', () => {
    const d: Doc = { ...newDocument(), walls: [wall('a', [0, 0], [4, 0], 'wt_masonry15')] };
    const s = deriveGeometry(d).solids.get('a')!;
    expect(s.layers).toEqual(d.wallTypes.find((t) => t.id === 'wt_masonry15')!.layers);
  });
});
