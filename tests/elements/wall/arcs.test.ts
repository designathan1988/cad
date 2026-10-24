// Arc walls (docs/wall-joins-spec.md §5.2). The segmentation count is the spec's formula, written
// here on its own; every other expected value is worked out by hand from circles and chords.

import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/core/vector';
import { LAYER_PRIORITY, type WallLayer } from '../../../src/elements/wall/schema';
import { geometry, layer, testWall, type TestWall } from './fixtures';
import { inside, rectOf, shoelace } from './oracle';
import { arcBody, tBeyond, tFill } from './oracle-arc';
import { setPrecision, union } from 'polyclip-ts';

setPrecision(1e-9);

/** Within a hair of a body's side: a sample there could fall either way. */
const nearSide = (b: readonly { x: number; y: number }[], p: { x: number; y: number }) =>
  b.some((a, i) => {
    const c = b[(i + 1) % b.length]!;
    const ab = { x: c.x - a.x, y: c.y - a.y };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
    return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t) < 1e-7;
  });

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
  // A T against an arc wider than one chord (docs/wall-joins-spec.md, part 6): near its end the wall
  // is split by the radial wedges of the segments it reaches, and each part takes that segment's T.
  // Strictly around the end: inside a body, or in what the T fills between the square end and the
  // arc's face (tFill), exactly one piece; anywhere else, none.
  const strictT = (walls: TestWall[], at: { x: number; y: number }, reach: number) => {
    const { pieces } = geometry(walls);
    const polys = walls.flatMap((w) => (pieces.get(w.id) ?? []).map((p) => p.polygon));
    const bodies = walls.flatMap((w) => (w.bulge ? arcBody(w) : [rectOf(w)]));
    const fill = tFill(walls[0]!, walls[1]!);
    const beyond = tBeyond(walls[0]!, walls[1]!);
    const [arcBodies, rect] = [arcBody(walls[0]!), rectOf(walls[1]!)];
    let bad = 0;
    let first: unknown = null;
    for (let i = 0; i < 4000; i++) {
      const a = (i * 2.399963) % (2 * Math.PI);
      const r = reach * Math.sqrt((i + 0.5) / 4000);
      const p = { x: at.x + r * Math.cos(a), y: at.y + r * Math.sin(a) };
      const count = polys.filter((q) => inside(q, p)).length;
      // The arc's body; the wall's own, less what pokes past the arc; and the filled corner.
      const want = arcBodies.some((b) => inside(b, p)) || (inside(rect, p) && !beyond(p)) || fill(p) ? 1 : 0;
      if (count !== want && !bodies.some((b) => nearSide(b, p))) {
        bad++;
        first ??= { p, count, want };
      }
    }
    return { bad, first };
  };

  it('a straight wall wider than one chord, abutting the arc from inside, joins exactly over the chords it meets', () => {
    // r = 3, chords of about 11 cm; a 30 cm wall meets three of them on the inner face (r = 2.9).
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(3, 1), vec(3, 2.95), 0.3)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    // Nothing of it past the inner face: every vertex within radius 2.9 of the centre (3, 0).
    for (const p of g.pieces.get('t')!) for (const v of p.polygon) expect(Math.hypot(v.x - 3, v.y)).toBeLessThanOrEqual(2.9 + 1e-9);
    expect(strictT(walls, vec(3, 2.95), 0.6)).toEqual({ bad: 0, first: null });
  });

  it('a wall ending on a joint of the arc itself, (3, 3) at 90°, abuts it (not a node with the two segment ends)', () => {
    // 88 segments over 180°: a joint at 90°, on the reference line at (3, 3).
    expect(segmentsFor(Math.PI, 3.1) % 2).toBe(0);
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(3, 5), vec(3, 3), 0.2)];
    expect(geometry(walls).warnings).toEqual([]);
    expect(strictT(walls, vec(3, 3), 0.6)).toEqual({ bad: 0, first: null });
  });

  it('a thin wall at a slant passing the reference line of the next segment on its way in: one T, not an X', () => {
    // Found by the property suite: its axis crosses arc#6's reference line 6.6 cm before its end in
    // arc#5, inside the arc's band all the way. It was refused as a crossing.
    const walls: TestWall[] = [
      { ...testWall('arc', vec(0, 0), vec(1.1036743651242062, 0), [layer(0.061429818938786664, 'finish1'), layer(0.03588418202928257), layer(0.01669276400024687)]), bulge: 0.5682682761210138 },
      testWall('t', vec(0.5579041931613289, -1.5241762614668275), vec(0.2050579539309692, -0.15688440718350088), [layer(0.012353262626080235, 'finish2')]),
    ];
    expect(geometry(walls).warnings).toEqual([]);
    expect(strictT(walls, vec(0.2050579539309692, -0.15688440718350088), 0.4)).toEqual({ bad: 0, first: null });
  });

  it('from outside, against the convex face, the same', () => {
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(3, 5), vec(3, 3.05), 0.3)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    expect(strictT(walls, vec(3, 3.05), 0.6)).toEqual({ bad: 0, first: null });
  });

  it('layered, at a slant: the core runs to the arc core face and the arc finish is notched for it, exactly', () => {
    // Plastered arc (finish 2 cm outside, core 15, finish 3 inside) and a plastered wall coming in at
    // 60° from outside, its end in the middle of the arc's band (r = 3): both corners of its square end,
    // ±0.1·sin 60° = ±0.087 in radius, are inside the arc. (With the end on the outer face, the T fills
    // the corner between its square end and the face, which this strict check counts as outside.)
    const at = vec(3 + 3 * Math.cos(1.2), 3 * Math.sin(1.2));
    const from = vec(at.x + 2 * Math.cos(0.9), at.y + 2 * Math.sin(0.9));
    const walls = [arc('arc', [0, 0], [6, 0], -1, plastered), testWall('t', from, at, plastered)];
    const g = geometry(walls);
    expect(g.warnings).toEqual([]);
    expect(strictT(walls, at, 0.8)).toEqual({ bad: 0, first: null });
    // By priority (spec §7.2): the wall's core (layer 1) runs to the arc's core face; any other layer
    // passes the arc's outer finish only when that finish has strictly lower priority, and then stops on
    // the core face too, else on the outer face. Radii from the centre (3, 0); faces are chords, so
    // within cos(Δ/2) of their circles.
    const r = (v: { x: number; y: number }) => Math.hypot(v.x - 3, v.y);
    const arcPieces = g.pieces.get('arc')!;
    const outer = Math.max(...arcPieces.flatMap((p) => p.polygon.map(r)));
    const coreFace = Math.max(...arcPieces.filter((p) => p.layerIndex === 1).flatMap((p) => p.polygon.map(r)));
    // The arc's outer layer: the one reaching the outer face.
    const outerLayer = arcPieces.find((p) => p.polygon.some((v) => Math.abs(r(v) - outer) < 1e-9))!.layerIndex;
    const cos = Math.cos(Math.PI / segmentsFor(Math.PI, outer) / 2);
    const deepest = (k: number) => Math.min(...g.pieces.get('t')!.filter((p) => p.layerIndex === k).flatMap((p) => p.polygon.map(r)));
    for (const k of [0, 1, 2]) {
      const passes = k === 1 || LAYER_PRIORITY[plastered[outerLayer]!.function] > LAYER_PRIORITY[plastered[k]!.function];
      const face = passes ? coreFace : outer;
      expect(deepest(k), `layer ${k}`).toBeGreaterThanOrEqual(face * cos - 1e-9);
      expect(deepest(k), `layer ${k}`).toBeLessThanOrEqual(face + 1e-9);
    }
  });

  it('a wall reaching past the end of the arc: within the arc it abuts, past it keeps its own square end', () => {
    // Near (6, 0), the arc's end (its radial cap on y = 0), a 60 cm wall from y = -0.15 to 0.45: the
    // part above y = 0 abuts the arc's last segments, the part below has nothing to stop at.
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('t', vec(4.5, 0.15), vec(5.95, 0.15), 0.6)];
    expect(geometry(walls).warnings).toEqual([]);
    expect(strictT(walls, vec(5.95, 0.15), 0.8)).toEqual({ bad: 0, first: null });
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

  // An arc ending against a straight plastered wall, from the side: the T is carried back along the
  // chord segments that still reach into the host, each kept inside its own wedge.
  describe('an arc ending against a straight wall', () => {
    for (const [bulge, start] of [
      [0.3, [1, 4]],
      [0.5, [1, 1]],
      [-0.3, [1, 4]],
      [1, [1, 4]],
    ] as const) {
      it(`bulge ${bulge} from (${start.join(', ')}): joins without a warning, no gap, no overlap, nothing past the core face`, () => {
        // Host x = 5 from y 0 to 8; its near (−x) side: finish2 from x 4.90 to 4.93, core from 4.93.
        const walls = [testWall('s', vec(5, 0), vec(5, 8), plastered), arc('arc', [start[0], start[1]], [5, 4], bulge, plastered)];
        const g = geometry(walls);
        expect(g.warnings).toEqual([]);
        for (const p of g.pieces.get('arc')!) for (const v of p.polygon) expect(v.x).toBeLessThanOrEqual(4.93 + 1e-9);
        // Tiling: the pieces' areas add up to the area of their union, which is one outline with no hole.
        const all = [...g.pieces.get('arc')!, ...g.pieces.get('s')!];
        const sum = all.reduce((t, p) => t + shoelace(p.polygon), 0);
        const [first, ...rest] = all.map((p) => [p.polygon.map((v) => [v.x, v.y] as [number, number])]);
        const u = union(first!, ...rest);
        expect(u).toHaveLength(1);
        expect(u[0]!).toHaveLength(1);
        const ring = u[0]![0]!.map(([x, y]) => ({ x, y }));
        expect(Math.abs(shoelace(ring))).toBeCloseTo(sum, 6);
      });
    }
  });

  // An X with an arc (spec 6, Crossing): the thicker core passes, the other is cut into two spans, each
  // a T against it. Strictly around the crossing: inside either body, exactly one piece; outside, none.
  const strictX = (walls: TestWall[], at: { x: number; y: number }, reach: number) => {
    const { pieces, warnings } = geometry(walls);
    const polys = walls.flatMap((w) => (pieces.get(w.id) ?? []).map((p) => p.polygon));
    const bodies = walls.flatMap((w) => (w.bulge ? arcBody(w) : [rectOf(w)]));
    let bad = 0;
    for (let i = 0; i < 4000; i++) {
      const t = (i * 2.399963) % (2 * Math.PI);
      const r = reach * Math.sqrt((i + 0.5) / 4000);
      const p = { x: at.x + r * Math.cos(t), y: at.y + r * Math.sin(t) };
      if (bodies.some((b) => nearSide(b, p))) continue;
      if (polys.filter((q) => inside(q, p)).length !== (bodies.some((b) => inside(b, p)) ? 1 : 0)) bad++;
    }
    return { warnings, bad };
  };

  it('a thin straight wall crossing a thicker arc: the arc passes, the wall is cut on both sides, exactly', () => {
    // 10 cm across the 20 cm arc at the top, x = 3 from y = 2 to 4.
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.2), testWall('x', vec(3, 2), vec(3, 4), 0.1)];
    expect(strictX(walls, vec(3, 3), 0.6)).toEqual({ warnings: [], bad: 0 });
    // The arc is whole across the crossing: nothing of the wall inside its band. The outer face is chords,
    // which lie inside the 3.1 circle by up to their sag: 3.1·cos(Δ/2) − 3 off the reference circle.
    const off = Math.min(3.1 * Math.cos(Math.PI / segmentsFor(Math.PI, 3.1) / 2) - 3, 0.1);
    expect(geometry(walls).pieces.get('x')!.every((p) => p.polygon.every((v) => Math.abs(Math.hypot(v.x - 3, v.y) - 3) >= off - 1e-9))).toBe(true);
  });

  it('a thick straight wall crossing a thin arc: the wall passes, the arc is cut on both sides, exactly', () => {
    const walls = [arc('arc', [0, 0], [6, 0], -1, 0.1), testWall('x', vec(3, 2), vec(3, 4), 0.3)];
    expect(strictX(walls, vec(3, 3), 0.6)).toEqual({ warnings: [], bad: 0 });
    // Nothing of the arc inside the wall's band x ∈ [2.85, 3.15].
    expect(geometry(walls).pieces.get('arc')!.every((p) => p.polygon.every((v) => v.x <= 2.85 + 1e-9 || v.x >= 3.15 - 1e-9))).toBe(true);
  });

  it('at a slant, layered both: the arc passes, exactly', () => {
    const c = vec(3 + 3 * Math.cos(1.1), 3 * Math.sin(1.1));
    const u = vec(Math.cos(0.5), Math.sin(0.5));
    const walls = [arc('arc', [0, 0], [6, 0], -1, plastered), testWall('x', vec(c.x - u.x, c.y - u.y), vec(c.x + u.x, c.y + u.y), [layer(0.01, 'finish1'), layer(0.08), layer(0.01, 'finish2')])];
    expect(strictX(walls, c, 0.6)).toEqual({ warnings: [], bad: 0 });
  });
});
