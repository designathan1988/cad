// Joined walls of different heights (spec §7.5): each wall is sliced at its neighbours' bases and
// tops, and each slice is joined only with the walls present at that height. So the cross-section of
// the 3D blocks at any height z is the plan join of the walls present at z, and a wall past the top
// of the one it meets ends as if alone (its free end, square). Walls whose height ranges do not
// overlap do not join (§6 step 3, §10).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallHeights } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { computeWallGeometry } from '../../src/elements/wall/geometry/footprint';
import { area } from '../../src/elements/wall/geometry/convex';
import { inside } from '../elements/wall/oracle';

type P = { x: number; y: number };
// 20 cm of concrete on the centre line; base and top in metres above the ground level (2.8 m).
const wall = (id: string, a: [number, number], b: [number, number], base = 0, top = 2.8): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: base,
  top: { kind: 'fixed', height: top - base },
});
const docOf = (walls: DocWall[]): Doc => ({ ...newDocument(), walls });

/** Which walls' blocks hold (p, z). */
const wallsAt = (doc: Doc, p: P, z: number) =>
  [...deriveGeometry(doc).solids.values()].filter((s) => s.blocks.some((b) => b.bottom < z && b.top > z && inside(b.polygon, p))).map((s) => s.wall.id);

describe('an L between a 1 m wall and a 2.8 m wall', () => {
  // a from (0, 0) to (4, 0), 1 m; b from (4, 0) to (4, 3), 2.8 m. Below 1 m: the mitre, the line
  // x + y = 4 through the outer corner (4.1, -0.1) and the inner one (3.9, 0.1). Above: b alone,
  // square at its start, y = 0.
  const doc = docOf([wall('a', [0, 0], [4, 0], 0, 1), wall('b', [4, 0], [4, 3])]);
  it("below 1 m, the mitre: the corner's outer triangle is b's, the inner one a's", () => {
    expect(wallsAt(doc, { x: 4.07, y: -0.05 }, 0.5)).toEqual(['b']);
    expect(wallsAt(doc, { x: 3.95, y: 0.03 }, 0.5)).toEqual(['a']);
  });
  it('above 1 m, b alone: square at y = 0, nothing of the corner below it', () => {
    expect(wallsAt(doc, { x: 4.07, y: -0.05 }, 2)).toEqual([]);
    expect(wallsAt(doc, { x: 3.95, y: 0.03 }, 2)).toEqual(['b']);
    expect(wallsAt(doc, { x: 4.05, y: 0.05 }, 2)).toEqual(['b']);
  });
  it('b is two blocks high, a one', () => {
    const g = deriveGeometry(doc);
    expect(g.solids.get('a')!.blocks.map((x) => [x.bottom, x.top])).toEqual([[0, 1]]);
    expect(g.solids.get('b')!.blocks.map((x) => [x.bottom, x.top])).toEqual([
      [0, 1],
      [1, 2.8],
    ]);
    expect(g.warnings).toEqual([]);
  });
});

describe('a T whose host is lower than the abutting wall', () => {
  // Host h from (0, 0) to (6, 0), 1 m; stem s from (3, 3) to (3, 0), 2.8 m. Below 1 m the stem stops
  // at the host's face, y = 0.1; above, it runs to its own end, y = 0, square.
  const doc = docOf([wall('h', [0, 0], [6, 0], 0, 1), wall('s', [3, 3], [3, 0])]);
  it('inside the host band: the host below 1 m, the stem above it', () => {
    expect(wallsAt(doc, { x: 3, y: 0.05 }, 0.5)).toEqual(['h']);
    expect(wallsAt(doc, { x: 3, y: 0.05 }, 2)).toEqual(['s']);
    expect(wallsAt(doc, { x: 3, y: -0.05 }, 2)).toEqual([]);
  });
});

describe('a T whose abutting wall is lower', () => {
  // Host 2.8 m, stem 1 m: the host is whole at every height; the stem stops at its face below 1 m.
  const doc = docOf([wall('h', [0, 0], [6, 0]), wall('s', [3, 3], [3, 0], 0, 1)]);
  it('the host covers its band at every height, the stem only below 1 m', () => {
    for (const z of [0.5, 2]) expect(wallsAt(doc, { x: 3, y: 0.05 }, z)).toEqual(['h']);
    expect(wallsAt(doc, { x: 3, y: 0.5 }, 0.5)).toEqual(['s']);
    expect(wallsAt(doc, { x: 3, y: 0.5 }, 2)).toEqual([]);
  });
});

describe('a wall standing on a base offset', () => {
  // a from 0 to 2.8; b from 1 m to 2.8 m. Below 1 m a is alone and square at its end, x = 4; above,
  // the mitre.
  const doc = docOf([wall('a', [0, 0], [4, 0]), wall('b', [4, 0], [4, 3], 1)]);
  it('below b, a ends square; above, the mitre', () => {
    expect(wallsAt(doc, { x: 4.07, y: -0.05 }, 0.5)).toEqual([]);
    expect(wallsAt(doc, { x: 3.95, y: 0.03 }, 0.5)).toEqual(['a']);
    expect(wallsAt(doc, { x: 4.07, y: -0.05 }, 2)).toEqual(['b']);
    expect(wallsAt(doc, { x: 3.95, y: 0.03 }, 2)).toEqual(['a']);
    // In a's square end but past the mitre line (x <= 4, x + y > 4): a's below 1 m, b's above.
    expect(wallsAt(doc, { x: 3.98, y: 0.07 }, 0.5)).toEqual(['a']);
    expect(wallsAt(doc, { x: 3.98, y: 0.07 }, 2)).toEqual(['b']);
  });
});

describe('walls whose heights do not overlap', () => {
  // a up to 1 m, b from 1.5 m: no join at all, in plan or in 3D, and no warning (§10).
  const doc = docOf([wall('a', [0, 0], [4, 0], 0, 1), wall('b', [4, 0], [4, 3], 1.5)]);
  it('each is its own rectangle, square at the corner', () => {
    const g = deriveGeometry(doc);
    expect(g.warnings).toEqual([]);
    expect(g.solids.get('a')!.pieces.map((p) => area(p.polygon))).toEqual([expect.closeTo(0.8, 9)]);
    expect(g.solids.get('b')!.pieces.map((p) => area(p.polygon))).toEqual([expect.closeTo(0.6, 9)]);
    // Square ends: a stops at x = 4, b starts at y = 0.
    expect(wallsAt(doc, { x: 3.98, y: 0.07 }, 0.5)).toEqual(['a']);
    expect(wallsAt(doc, { x: 4.05, y: -0.05 }, 0.5)).toEqual([]);
    expect(wallsAt(doc, { x: 4.05, y: -0.05 }, 2)).toEqual([]);
  });
  it('touching heights (a up to 1 m, b from 1 m) do not join either', () => {
    const g = deriveGeometry(docOf([wall('a', [0, 0], [4, 0], 0, 1), wall('b', [4, 0], [4, 3], 1)]));
    expect(g.solids.get('a')!.pieces.map((p) => area(p.polygon))).toEqual([expect.closeTo(0.8, 9)]);
    // The area is the mitre's too: the square end tells them apart (x <= 4, x + y > 4 is a's).
    const touching = docOf([wall('a', [0, 0], [4, 0], 0, 1), wall('b', [4, 0], [4, 3], 1)]);
    expect(wallsAt(touching, { x: 3.98, y: 0.07 }, 0.5)).toEqual(['a']);
    expect(wallsAt(touching, { x: 4.05, y: 0.05 }, 2)).toEqual(['b']);
  });
});

// Property: an L, a T or an X between two walls, or a corner and a T with three, each with its own
// base and top. At random points and heights, the blocks holding the point are exactly the plan
// pieces of the join of the walls present at that height (computeWallGeometry with only them), and
// the blocks' volume is the sum over heights of those joins' areas (spec §11, I2).
const heightArb = fc.tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 1, max: 14 })).map(([b, h]) => [b / 10, Math.min(b + h, 28) / 10] as const);
const scenes: [string, (hs: readonly (readonly [number, number])[]) => DocWall[]][] = [
  ['L', ([a, b]) => [wall('a', [0, 0], [4, 0], ...a!), wall('b', [4, 0], [4, 3], ...b!)]],
  ['T', ([a, b]) => [wall('a', [0, 0], [6, 0], ...a!), wall('b', [3, 3], [3, 0], ...b!)]],
  ['X', ([a, b]) => [wall('a', [0, 0], [6, 0], ...a!), wall('b', [3, 3], [3, -3], ...b!)]],
  ['L and T', ([a, b, c]) => [wall('a', [0, 0], [4, 0], ...a!), wall('b', [4, 0], [4, 3], ...b!), wall('c', [2, 3], [2, 0], ...c!)]],
];

describe('cross-sections are the joins of the walls present', () => {
  for (const [name, make] of scenes) {
    it(`${name}: every sampled point, and the volume`, () => {
      fc.assert(
        fc.property(fc.array(heightArb, { minLength: 3, maxLength: 3 }), fc.integer({ min: 1, max: 1e6 }), (hs, seed) => {
          const walls = make(hs);
          const doc = docOf(walls);
          const g = deriveGeometry(doc);
          const blocks = [...g.solids.values()].flatMap((s) => s.blocks.map((b) => ({ ...b, wall: s.wall.id })));
          const types = new Map(doc.wallTypes.map((t) => [t.id, t]));
          const range = new Map(walls.map((w) => [w.id, wallHeights(doc, w)]));
          const present = (z: number) => walls.filter((w) => range.get(w.id)!.bottom < z && range.get(w.id)!.top > z);
          let r = seed;
          const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
          for (let i = 0; i < 300; i++) {
            const z = 0.05 + 2.7 * rnd();
            const p = { x: -0.5 + 7 * rnd(), y: -3.5 + 7 * rnd() };
            const want = computeWallGeometry(present(z), types);
            const expected = [...want.pieces].filter(([, ps]) => ps.some((q) => inside(q.polygon, p))).map(([id]) => id).sort();
            const got = blocks.filter((b) => b.bottom < z && b.top > z && inside(b.polygon, p)).map((b) => b.wall).sort();
            expect(got, `${JSON.stringify(walls)} at ${JSON.stringify(p)}, z ${z}`).toEqual(expected);
          }
          // I2: the blocks' volume, and the joins' areas over the height ranges where the same walls stand.
          const zs = [...new Set(walls.flatMap((w) => [range.get(w.id)!.bottom, range.get(w.id)!.top]))].sort((a, b) => a - b);
          let want = 0;
          for (let k = 0; k + 1 < zs.length; k++) {
            const mid = (zs[k]! + zs[k + 1]!) / 2;
            const joined = computeWallGeometry(present(mid), types);
            want += [...joined.pieces.values()].flat().reduce((s, q) => s + area(q.polygon), 0) * (zs[k + 1]! - zs[k]!);
          }
          const got = blocks.reduce((s, b) => s + area(b.polygon) * (b.top - b.bottom), 0);
          expect(got).toBeCloseTo(want, 9);
        }),
        { numRuns: 60, seed: 20261024 },
      );
    });
  }
});
