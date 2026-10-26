// Junctions (docs/wall-joins-spec.md §7.6): crossings at one point or a few centimetres apart, an end on
// a crossing, an end inside an L's corner, and a Y of unlike thicknesses. Two checks that share nothing
// with the engine: points sampled around the walls are covered by exactly one piece where the bands are
// (crossings only: there the joined walls are the union of their bands), and the pieces' union is one
// outline whose only vertices near the junction are the corners where neighbouring faces meet, worked
// out by hand (a notch, a step or a stub of finish would add vertices there or open a hole).

import { describe, expect, it } from 'vitest';
import { setPrecision, union } from 'polyclip-ts';
import { vec } from '../../../src/core/vector';
import { overlapArea } from '../../../src/elements/wall/geometry/convex';
import { geometry, testWall, type TestWall } from './fixtures';
import { checkAgainst, inside, type P, rectOf, type Region, shoelace } from './oracle';

setPrecision(1e-9);

type XY = readonly [number, number];
const r = Math.PI / 180;
const dir = (deg: number): XY => [Math.cos(deg * r), Math.sin(deg * r)];
/** Counter-clockwise normal. */
const ccwNormal = ([x, y]: XY): XY => [-y, x];
const neg = ([x, y]: XY): XY => [-x, -y];

/** Where the face lines m1·p = h1 and m2·p = h2 meet (Cramer). */
function facesMeet(m1: XY, h1: number, m2: XY, h2: number): XY {
  const det = m1[0] * m2[1] - m1[1] * m2[0];
  return [(h1 * m2[1] - m1[1] * h2) / det, (m1[0] * h2 - h1 * m2[0]) / det];
}

/**
 * The corner across the gap from arm a to the next arm b counter-clockwise, both leaving the point
 * `at`: a's face on its counter-clockwise side, b's on its clockwise side.
 */
function corner(at: XY, a: { deg: number; half: number }, b: { deg: number; half: number }): XY {
  const ma = ccwNormal(dir(a.deg));
  const mb = neg(ccwNormal(dir(b.deg)));
  const ha = a.half + ma[0] * at[0] + ma[1] * at[1];
  const hb = b.half + mb[0] * at[0] + mb[1] * at[1];
  return facesMeet(ma, ha, mb, hb);
}

function piecesOf(walls: readonly TestWall[]) {
  const g = geometry(walls);
  return { g, polys: walls.flatMap((w) => (g.pieces.get(w.id) ?? []).map((p) => p.polygon)) };
}

function expectNoOverlap(polys: readonly (readonly P[])[]): void {
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) expect(overlapArea(polys[i]!, polys[j]!)).toBeLessThan(1e-9);
  }
}

/** The pieces' union: one ring, no hole; its vertices within `radius` of `at`. */
function outlineNear(polys: readonly (readonly P[])[], at: XY, radius: number): XY[] {
  const [first, ...rest] = polys.map((p) => [p.map((v) => [v.x, v.y] as [number, number])]);
  const u = union(first!, ...rest);
  expect(u).toHaveLength(1);
  expect(u[0]!).toHaveLength(1);
  const ring = u[0]![0]!.slice(0, -1);
  return ring.filter(([x, y]) => Math.hypot(x - at[0], y - at[1]) < radius).map(([x, y]) => [x, y] as XY);
}

function expectVertices(actual: readonly XY[], expected: readonly XY[]): void {
  expect(actual, JSON.stringify(actual)).toHaveLength(expected.length);
  for (const [x, y] of expected) {
    const hit = actual.some(([ax, ay]) => Math.abs(ax - x) < 1e-7 && Math.abs(ay - y) < 1e-7);
    expect(hit, `missing outline vertex (${x}, ${y}) in ${JSON.stringify(actual)}`).toBe(true);
  }
}

const edgesOf = (poly: readonly P[]): [P, P][] => poly.map((a, i) => [a, poly[(i + 1) % poly.length]!]);

/**
 * The union of the walls' own bands, less `minus` (a triangle inside it), sampled by containment; its
 * area from polyclip.
 */
function bandsRegion(walls: readonly TestWall[], minus: readonly P[] = []): Region {
  const rects = walls.map(rectOf);
  const [first, ...rest] = rects.map((p) => [p.map((v) => [v.x, v.y] as [number, number])]);
  const area = union(first!, ...rest).reduce(
    (s, poly) => s + poly.reduce((t, ring, k) => t + (k === 0 ? 1 : -1) * shoelace(ring.slice(0, -1).map(([x, y]) => ({ x, y }))), 0),
    0,
  );
  return {
    area: area - (minus.length ? shoelace(minus) : 0),
    contains: (p) => rects.some((rect) => inside(rect, p)) && !(minus.length && inside(minus, p)),
    edges: [...rects.flatMap(edgesOf), ...(minus.length ? edgesOf(minus) : [])],
  };
}

function expectBands(walls: readonly TestWall[], seed: number, minus: readonly P[] = []): void {
  const report = checkAgainst(walls, bandsRegion(walls, minus), seed);
  expect(report.overlaps, `first bad sample ${JSON.stringify(report.firstBad)}`).toBe(0);
  expect(report.gaps, `first bad sample ${JSON.stringify(report.firstBad)}`).toBe(0);
  expect(report.extras, `first bad sample ${JSON.stringify(report.firstBad)}`).toBe(0);
  expect(report.areaError).toBeLessThan(1e-9);
}

describe('three walls crossing at one point', () => {
  // 10 cm walls along 0°, 45° and 90° through the origin: six arms 45° apart. Each neighbouring pair
  // meets on the bisector, 0.05/sin 22.5° from the point.
  const walls = [
    testWall('a', vec(-3, 0), vec(3, 0), 0.1),
    testWall('b', vec(0, -3), vec(0, 3), 0.1),
    testWall('c', vec(-3, -3), vec(3, 3), 0.1),
  ];
  const { g, polys } = piecesOf(walls);

  it('joins without a warning, each wall split once at the point', () => {
    expect(g.warnings).toEqual([]);
    for (const w of walls) expect(g.pieces.get(w.id)).toHaveLength(2);
  });

  it('covers exactly the three bands, nothing twice', () => {
    expectNoOverlap(polys);
    expectBands(walls, 1);
  });

  it('the outline near the point: the 45° gaps meet on their bisectors, the 90° ones square', () => {
    // Arms at 0, 45, 90, 180, 225, 270: the gaps are 45, 45, 90, 45, 45, 90. A 45° gap's faces meet
    // 0.05/sin 22.5° out on its bisector; the 90° gaps (90→180, 270→360) at (∓0.05, ±0.05).
    const d = 0.05 / Math.sin(22.5 * r);
    const on = (deg: number): XY => [d * Math.cos(deg * r), d * Math.sin(deg * r)];
    expectVertices(outlineNear(polys, [0, 0], 0.5), [on(22.5), on(67.5), [-0.05, 0.05], on(202.5), on(247.5), [0.05, -0.05]]);
  });
});

describe('three walls crossing a few centimetres apart', () => {
  // As above, but the 45° wall passes 6 cm to the right of the origin along x (drawn by hand, no snap):
  // it crosses a at (0.06, 0) and b at (0, −0.06). Its faces are x − y = 0.06 ± 0.05·√2.
  const walls = [
    testWall('a', vec(-3, 0), vec(3, 0), 0.1),
    testWall('b', vec(0, -3), vec(0, 3), 0.1),
    testWall('c', vec(-2.94, -3), vec(3.06, 3), 0.1),
  ];
  const { g, polys } = piecesOf(walls);
  const s = 0.05 * Math.SQRT2;

  it('is one junction: no warning, each wall split once', () => {
    expect(g.warnings).toEqual([]);
    for (const w of walls) expect(g.pieces.get(w.id)).toHaveLength(2);
  });

  it('covers the three bands, nothing twice, the corner between b and a squared', () => {
    // Passing 6 cm off, c's lower face x − y = 0.06 + 0.05·√2 cuts across the square corner between b
    // (going down) and a (going right): its band holds the sliver (0.05, −0.05), (0.05, −0.01 − s),
    // (0.01 + s, −0.05), outside a and b. The junction joins the three as meeting at one point, the way
    // they were meant to, and squares that corner like the others.
    expectNoOverlap(polys);
    expectBands(walls, 2, [
      { x: 0.05, y: -0.05 },
      { x: 0.05, y: -0.01 - s },
      { x: 0.01 + s, y: -0.05 },
    ]);
  });

  it('the outline near the crossings is the six corners of the facing faces, no stubs', () => {
    expectVertices(outlineNear(polys, [0, 0], 0.5), [
      [0.05 + 0.06 + s, 0.05], // a's upper face and c's lower face
      [0.05, 0.05 - 0.06 + s], // c's upper face and b's right face
      [-0.05, 0.05],
      [-0.05 + 0.06 - s, -0.05], // a's lower face and c's upper face
      [-0.05, -0.05 - 0.06 - s], // c's lower face and b's left face
      [0.05, -0.05],
    ]);
  });
});

describe('an end on a crossing', () => {
  // a and b cross at the origin; c, 10 cm, starts there and leaves at 45°.
  const walls = [
    testWall('a', vec(-3, 0), vec(3, 0), 0.1),
    testWall('b', vec(0, -3), vec(0, 3), 0.1),
    testWall('c', vec(0, 0), vec(2, 2), 0.1),
  ];
  const { g, polys } = piecesOf(walls);
  const s = 0.05 * Math.SQRT2;

  it('joins without a warning; a and b split at the point, c whole', () => {
    expect(g.warnings).toEqual([]);
    expect(g.pieces.get('a')).toHaveLength(2);
    expect(g.pieces.get('b')).toHaveLength(2);
    expect(g.pieces.get('c')).toHaveLength(1);
  });

  it('covers exactly the three bands, nothing twice', () => {
    expectNoOverlap(polys);
    expectBands(walls, 3);
  });

  it('the outline near the point: c meets a and b at its faces, the other quadrants square', () => {
    expectVertices(outlineNear(polys, [0, 0], 0.5), [
      [0.05 + s, 0.05],
      [0.05, 0.05 + s],
      [-0.05, 0.05],
      [-0.05, -0.05],
      [0.05, -0.05],
    ]);
  });
});

describe('an end inside the corner of an L, from outside it', () => {
  // a comes along +x to the corner (0, 0), b leaves upward: an L. c comes from (2, −2) and stops 1 cm
  // inside both, at (−0.01, 0.01): its line is x + y = 0, its faces x + y = ±0.05·√2.
  const walls = [
    testWall('a', vec(-3, 0), vec(0, 0), 0.1),
    testWall('b', vec(0, 0), vec(0, 3), 0.1),
    testWall('c', vec(2, -2), vec(-0.01, 0.01), 0.1),
  ];
  const { g, polys } = piecesOf(walls);
  const s = 0.05 * Math.SQRT2;

  it('joins without a warning and nothing overlaps', () => {
    expect(g.warnings).toEqual([]);
    expectNoOverlap(polys);
  });

  it('the outline near the corner: the L inside, c meeting the outer face of each', () => {
    expectVertices(outlineNear(polys, [0, 0], 0.5), [
      [-0.05, 0.05],
      [0.05 - s, -0.05], // a's outer face y = −0.05 and c's face x + y = −0.05·√2
      [0.05, -0.05 + s], // b's outer face x = 0.05 and c's face x + y = 0.05·√2
    ]);
  });
});

describe('a Y of unlike thicknesses', () => {
  // a 25 cm down, b 15 cm toward (−2.4, 1.9), c 10 cm toward (2.4, 1.9), all from the origin. Seen from
  // the node, a's sector would be more than a half-turn: the corners where the faces meet lie beside
  // and above it. The lines start from the middle of the corners instead (§7.6), and the faces still
  // meet at those corners: no stretch of bare core, no step.
  const walls = [
    testWall('a', vec(0, 0), vec(0, -3), 0.25),
    testWall('b', vec(0, 0), vec(-2.4, 1.9), 0.15),
    testWall('c', vec(0, 0), vec(2.4, 1.9), 0.1),
  ];
  const { g, polys } = piecesOf(walls);
  const degB = Math.atan2(1.9, -2.4) / r;
  const degC = Math.atan2(1.9, 2.4) / r;

  it('joins without a warning and nothing overlaps', () => {
    expect(g.warnings).toEqual([]);
    for (const w of walls) expect(g.pieces.get(w.id)).toHaveLength(1);
    expectNoOverlap(polys);
  });

  it('the outline near the node is the three corners of the facing faces', () => {
    expectVertices(outlineNear(polys, [0, 0], 0.6), [
      corner([0, 0], { deg: degC, half: 0.05 }, { deg: degB, half: 0.075 }),
      corner([0, 0], { deg: degB, half: 0.075 }, { deg: 270, half: 0.125 }),
      corner([0, 0], { deg: 270, half: 0.125 }, { deg: degC + 360, half: 0.05 }),
    ]);
  });
});
