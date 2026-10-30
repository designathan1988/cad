// Junctions by sectors (docs/wall-joins-spec.md §7.6), on random scenes: three or four walls crossing
// at one point, and three to six ends meeting at one, of unlike thicknesses at angles at least 20°
// apart. Checks that share nothing with the engine:
// - crossings: the pieces cover exactly the union of the walls' bands (the walls go on through);
// - ends: no two pieces overlap, every point of a band away from the point is covered once, and the
//   pieces seen from the point are covered all the way to it (star-shaped: no hole, no pocket).
// No polygon library: polyclip-ts, given these pieces, overflowed its stack or could not close a ring.
// A scene the engine cannot split exactly says so (`complexJoin`); most must not.
// FUZZ_SEED picks a different seed; FUZZ_SCALE multiplies the run counts.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { vec } from '../../../src/model/vector';
import { overlapArea } from '../../../src/elements/wall/geometry/convex';
import { geometry, testWall, type TestWall } from './fixtures';
import { checkAgainst, inside, type P, rectOf, type Region } from './oracle';

const seed = Number(process.env.FUZZ_SEED ?? 20261026);
const scale = Number(process.env.FUZZ_SCALE ?? 1);
const runs = (n: number) => ({ numRuns: n * scale, seed });
const TIMEOUT = 600_000;
const MIN_GAP = 20;

/** `k` angles (degrees) going round `span`, each at least MIN_GAP from the next, from `turn`. */
const spread = (k: number, span: number) =>
  fc.tuple(fc.array(fc.double({ min: 0.05, max: 1, noNaN: true }), { minLength: k, maxLength: k }), fc.double({ min: 0, max: 360, noNaN: true })).map(([w, turn]) => {
    const sum = w.reduce((s, x) => s + x, 0);
    let at = turn;
    return w.map((x) => {
      const deg = at;
      at += MIN_GAP + (x / sum) * (span - MIN_GAP * k);
      return deg;
    });
  });

const thickness = fc.double({ min: 0.08, max: 0.35, noNaN: true });
const dirOf = (deg: number) => vec(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180));

const crossings = fc.integer({ min: 3, max: 4 }).chain((m) =>
  fc.tuple(spread(m, 180), fc.array(thickness, { minLength: m, maxLength: m })).map(([degs, ts]) =>
    degs.map((deg, i) => {
      const u = dirOf(deg);
      return testWall(`c${i}`, vec(-3 * u.x, -3 * u.y), vec(3 * u.x, 3 * u.y), ts[i]!);
    }),
  ),
);

const stars = fc.integer({ min: 3, max: 6 }).chain((k) =>
  fc.tuple(spread(k, 360), fc.array(thickness, { minLength: k, maxLength: k }), fc.array(fc.double({ min: 2, max: 4, noNaN: true }), { minLength: k, maxLength: k })).map(([degs, ts, ls]) =>
    degs.map((deg, i) => {
      const u = dirOf(deg);
      return testWall(`s${i}`, vec(0, 0), vec(ls[i]! * u.x, ls[i]! * u.y), ts[i]!);
    }),
  ),
);

const edgesOf = (poly: readonly P[]): [P, P][] => poly.map((a, i) => [a, poly[(i + 1) % poly.length]!]);

/** The union of the walls' bands, as the oracle's region (its area is not checked here). */
function bands(walls: readonly TestWall[]): Region {
  const rects = walls.map(rectOf);
  return { area: Number.NaN, contains: (p) => rects.some((r) => inside(r, p)), edges: rects.flatMap(edgesOf) };
}

/** Inside a counter-clockwise convex polygon, its sides included. */
const onOrInside = (q: readonly P[], p: P) =>
  q.every((a, k) => {
    const b = q[(k + 1) % q.length]!;
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-12;
  });

/**
 * Points of the pieces from which the way back to `at` leaves them: where the union is not star-shaped
 * from the point. Sector pieces, a passing wall's band and an end's band from the point each are, and a
 * union of such has no hole and no pocket. `count` random points per piece, each way checked at 1 mm.
 */
function hiddenFrom(polys: readonly (readonly P[])[], at: P, rnd: () => number, count: number): P | null {
  const covered = (p: P) => polys.some((q) => onOrInside(q, p));
  for (const q of polys) {
    for (let k = 0; k < count; k++) {
      // A random point of the polygon: of one triangle of its fan, chosen by area.
      const tris = q.slice(1, -1).map((b, i) => [q[0]!, b, q[i + 2]!] as const);
      const areas = tris.map(([a, b, c]) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2);
      let pick = rnd() * areas.reduce((s2, x) => s2 + x, 0);
      const [a, b, c] = tris.find((_, i) => (pick -= areas[i]!) <= 0) ?? tris[tris.length - 1]!;
      let u = rnd();
      let v = rnd();
      if (u + v > 1) [u, v] = [1 - u, 1 - v];
      const p = vec(a.x + u * (b.x - a.x) + v * (c.x - a.x), a.y + u * (b.y - a.y) + v * (c.y - a.y));
      const steps = Math.ceil(Math.hypot(p.x - at.x, p.y - at.y) / 0.001);
      for (let t = 1; t < steps; t++) {
        const m = vec(at.x + ((p.x - at.x) * t) / steps, at.y + ((p.y - at.y) * t) / steps);
        if (!covered(m)) return m;
      }
    }
  }
  return null;
}

/** Pseudo-random numbers in [0, 1), the same for a seed. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tally = { crossings: 0, crossingsSplit: 0, stars: 0, starsSplit: 0 };

describe('junctions by sectors, random scenes', () => {
  it('three or four walls crossing at one point: exactly the union of their bands', () => {
    fc.assert(
      fc.property(crossings, fc.nat(), (walls, sampleSeed) => {
        tally.crossings++;
        const g = geometry(walls);
        if (g.warnings.some((w) => w.kind === 'complexJoin')) return;
        expect(g.warnings, JSON.stringify(walls)).toEqual([]);
        tally.crossingsSplit++;
        const r = checkAgainst(walls, bands(walls), sampleSeed);
        const where = r.firstBad ? ` first at (${r.firstBad.x}, ${r.firstBad.y})` : '';
        expect({ overlaps: r.overlaps, gaps: r.gaps, extras: r.extras }, `${JSON.stringify(walls)}${where}`).toEqual({ overlaps: 0, gaps: 0, extras: 0 });
      }),
      runs(200),
    );
  }, TIMEOUT);

  it('three to six ends at one point: no overlap, the bands covered away from it, every piece in view of it', () => {
    fc.assert(
      fc.property(stars, fc.nat(), (walls, sampleSeed) => {
        tally.stars++;
        const g = geometry(walls);
        if (g.warnings.some((w) => w.kind === 'complexJoin')) return;
        expect(g.warnings, JSON.stringify(walls)).toEqual([]);
        tally.starsSplit++;
        const polys = walls.flatMap((w) => (g.pieces.get(w.id) ?? []).map((p) => p.polygon));
        for (let i = 0; i < polys.length; i++)
          for (let j = i + 1; j < polys.length; j++) expect(overlapArea(polys[i]!, polys[j]!), JSON.stringify(walls)).toBeLessThan(1e-9);
        // Away from the point (past the miter limit of the thickest), every band is plain wall.
        const away = 10 * Math.max(...walls.map((w) => w.thickness)) + 0.05;
        const rnd = mulberry32(sampleSeed);
        for (const w of walls) {
          const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
          if (len <= away) continue;
          const u = vec((w.end.x - w.start.x) / len, (w.end.y - w.start.y) / len);
          for (let k = 0; k < 40; k++) {
            const s = away + (len - away) * rnd();
            const n = (rnd() - 0.5) * w.thickness * 0.98;
            const p = vec(w.start.x + u.x * s - u.y * n, w.start.y + u.y * s + u.x * n);
            expect(polys.filter((q) => inside(q, p)).length, `${JSON.stringify(walls)} at ${JSON.stringify(p)}`).toBe(1);
          }
        }
        const hidden = hiddenFrom(polys, vec(0, 0), rnd, 20);
        expect(hidden, `not star-shaped from the point, at ${JSON.stringify(hidden)}: ${JSON.stringify(walls)}`).toBeNull();
      }),
      runs(300),
    );
  }, TIMEOUT);

  it('most scenes were split by sectors, not left with a warning', () => {
    expect(tally.crossings).toBeGreaterThan(0);
    expect(tally.stars).toBeGreaterThan(0);
    expect(tally.crossingsSplit / tally.crossings, JSON.stringify(tally)).toBeGreaterThan(0.9);
    expect(tally.starsSplit / tally.stars, JSON.stringify(tally)).toBeGreaterThan(0.9);
  });
});
