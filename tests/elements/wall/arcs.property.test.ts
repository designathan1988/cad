// Random arcs against the independent arc oracle (oracle-arc.ts): alone, and with a straight wall
// joined at one end. A join the engine cannot make exact must warn; one it makes must cover the
// bodies exactly once, and near the node exactly the spec's L (arcCorner).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { LayerFunction, WallEnd } from '../../../src/elements/wall/schema';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { arcBody, arcCorner, circleOf, coverage, distanceToSegments, intoOf, segmentsOf, touchesArcElsewhere } from './oracle-arc';
import { inside, shoelace } from './oracle';

const seed = Number(process.env.FUZZ_SEED ?? 20261024);
const SPEC_POINT_TOL = 1e-3;
const num = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const fns = fc.constantFrom<LayerFunction>('structure', 'finish1', 'finish2', 'thermal');
const layersArb = fc.array(fc.tuple(num(0.01, 0.15), fns), { minLength: 1, maxLength: 3 }).map((ls) => ls.map(([t, f]) => layer(t, f)));
const refArb = fc.constantFrom('centerline' as const, 'interiorFace' as const, 'exteriorFace' as const);

const arcArb = fc
  .record({
    start: fc.tuple(num(-5, 5), num(-5, 5)),
    heading: num(0, 2 * Math.PI),
    chord: num(1, 10),
    sweepDeg: fc.oneof(num(-300, -10), num(10, 300)),
    layers: layersArb,
    ref: refArb,
  })
  .map((r) => {
    const s = { x: r.start[0], y: r.start[1] };
    const e = { x: s.x + r.chord * Math.cos(r.heading), y: s.y + r.chord * Math.sin(r.heading) };
    return { ...testWall('arc', s, e, r.layers, r.ref), bulge: Math.tan((r.sweepDeg * Math.PI) / 180 / 4) } as Wall;
  })
  // Keep arcs whose faces all have a positive radius: tighter ones are tested as arcTooTight by hand.
  .filter((w) => {
    const a = circleOf(w);
    return a.r - w.thickness > 0.05;
  });

describe('lone arcs', () => {
  it('cover their body exactly, with the spec segment count', () => {
    fc.assert(
      fc.property(arcArb, fc.nat(), (w, s) => {
        const g = geometry([w]);
        expect(g.warnings).toEqual([]);
        const pieces = g.pieces.get('arc')!;
        expect(pieces).toHaveLength(segmentsOf(w) * w.layers.length);
        const body = arcBody(w).reduce((t, p) => t + shoelace(p), 0);
        const got = pieces.reduce((t, p) => t + shoelace(p.polygon), 0);
        expect(Math.abs(got - body), JSON.stringify(w)).toBeLessThan(1e-9);
        const c = coverage([w], null, 0, s);
        expect({ o: c.overlaps, g: c.gaps, e: c.extras }, JSON.stringify(w)).toEqual({ o: 0, g: 0, e: 0 });
      }),
      { numRuns: 100, seed },
    );
  });
});

const joined = { clean: 0, warned: 0, skipped: 0 };
describe('arc with a straight wall at one end', () => {
  it('joins exactly, or warns', () => {
    fc.assert(
      fc.property(
        arcArb,
        fc.constantFrom<WallEnd>('start', 'end'),
        num(30, 150),
        fc.boolean(),
        num(1, 5),
        layersArb,
        refArb,
        fc.nat(),
        (arc, end, deg, left, len, ls, ref, s) => {
          const node = end === 'start' ? arc.start : arc.end;
          const u = intoOf(arc, end);
          const a = ((left ? deg : -deg) * Math.PI) / 180;
          const v = { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
          const far = { x: node.x + v.x * len, y: node.y + v.y * len };
          // One junction only: a far end that lands on the arc (within POINT_TOLERANCE of a segment's
          // band, spec §6), or a wall passing near the arc's other end, makes a second one, which this
          // oracle does not model.
          const other = end === 'start' ? arc.end : arc.start;
          const clear = arc.thickness + Math.max(...ls.map((l) => l.thickness)) * ls.length + 0.1;
          const t = Math.max(0, Math.min(1, ((other.x - node.x) * v.x + (other.y - node.y) * v.y) / len));
          const nearOther = Math.hypot(node.x + v.x * len * t - other.x, node.y + v.y * len * t - other.y) < clear;
          if (nearOther || arcBody(arc).some((b) => inside(b, far)) || distanceToSegments(arc, far) <= SPEC_POINT_TOL) {
            joined.skipped++;
            return;
          }
          const straight = testWall('s', far, node, ls, ref);
          const walls = [arc, straight];
          const kinds = geometry(walls).warnings.map((w) => w.kind);
          // The spec decides: the L between the arc's end segment and the wall (§5.2: an arc joins as
          // its chain of straight segments) warns exactly when the straight L would (§7.1, §10:
          // 'overlap'). Any other warning is the engine failing a join the spec says to make.
          const corner = arcCorner(arc, end, straight, 'end');
          // Also when the wall touches the arc again away from the node (part 6: overlaps left with an
          // arc are reported). Where the L made with the end segment reaches over the next segments,
          // the engine carries it on, and the coverage below checks those segments' bodies.
          if (corner === 'overlap' || touchesArcElsewhere(arc, end, straight)) {
            expect(kinds.length, `spec warns: ${JSON.stringify(walls)}`).toBeGreaterThan(0);
            joined.warned++;
            return;
          }
          expect(kinds, `spec makes this L: ${JSON.stringify(walls)}`).toEqual([]);
          joined.clean++;
          const tip = 10 * Math.max(arc.thickness, straight.thickness) + 0.1;
          const c = coverage(walls, node, tip, s, corner);
          expect({ o: c.overlaps, g: c.gaps, e: c.extras }, `${JSON.stringify(walls)} at ${JSON.stringify(c.firstBad)}`).toEqual({ o: 0, g: 0, e: 0 });
        },
      ),
      { numRuns: 100, seed },
    );
  });

  // Not vacuous: most runs make the L and are checked point by point; few are skipped as a second
  // junction. The fixed seed gives 56 clean, 41 warned, 3 skipped of 100.
  it('checks enough joins', () => {
    console.log(`arc L: ${joined.clean} clean, ${joined.warned} warned, ${joined.skipped} skipped`);
    expect(joined.clean).toBeGreaterThan(40);
    expect(joined.skipped).toBeLessThanOrEqual(5);
  });
});
