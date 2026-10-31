// Random arcs against the independent arc oracle (oracle-arc.ts): alone, and with a straight wall
// joined at one end. A join the engine cannot make exact must warn; one it makes must cover the
// bodies exactly once, and near the node exactly the spec's L (arcCorner).

import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import type { LayerFunction, WallEnd } from '../../../src/elements/wall/schema';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { arcBody, arcCorner, circleOf, cornerReach, coverage, distanceToSegments, faceRadii, intoOf, segmentsOf, tBeyond, tFill, touchesArcElsewhere } from './oracle-arc';
import { inside, rectOf, shoelace } from './oracle';
import { wid } from '../../ids';

const seed = Number(process.env.FUZZ_SEED ?? 20261024);
// As joins.property.test.ts: a run takes as long as it takes, more under a busy machine (a mutation run
// beside it) than the 5 s a plain test gets.
vi.setConfig({ testTimeout: 600_000 });
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
    return { ...testWall(wid('arc'), s, e, r.layers, r.ref), bulge: Math.tan((r.sweepDeg * Math.PI) / 180 / 4) } as Wall;
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
        const pieces = g.pieces.get(wid('arc'))!;
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

const joined = { clean: 0, warned: 0, skipped: 0, spill: 0, nearOther: 0, touches: 0 };
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
        (arc, end, deg, left, len0, ls, ref, s) => {
          const node = end === 'start' ? arc.start : arc.end;
          const u = intoOf(arc, end);
          const a = ((left ? deg : -deg) * Math.PI) / 180;
          const v = { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
          // Where the wall first touches the arc's other segments (touching only grows with length, so a
          // binary search finds it). Within the reach of the L's corner (cornerReach: from the faces and
          // the angle) that is the L itself reaching past the end segment, which the spec makes (§7.1,
          // "ponta livre": the end segment is not free where the arc goes on). Beyond, it would be a
          // second junction, which this oracle does not model: the wall is shortened to 95 % of that
          // length.
          const wallOf = (l: number) => testWall(wid('s'), { x: node.x + v.x * l, y: node.y + v.y * l }, node, ls, ref);
          let len = len0;
          let spilling = false;
          if (touchesArcElsewhere(arc, end, wallOf(len))) {
            let [lo, hi] = [0, len];
            for (let k = 0; k < 14; k++) {
              const mid = (lo + hi) / 2;
              if (touchesArcElsewhere(arc, end, wallOf(mid))) hi = mid;
              else lo = mid;
            }
            // Within the corner's reach it is the L itself reaching past the end segment, which the
            // engine makes (spillOverArc): checked below like any L, and counted.
            const reach = cornerReach(arc, end, wallOf(len)) + SPEC_POINT_TOL;
            if (hi <= reach) {
              spilling = true;
              // It can touch again farther on as well (a second junction): the stretch past the corner's
              // reach is shortened like any wall, to 95 % of where it would.
              const tail = (l: number) => testWall(wid('s'), { x: node.x + v.x * l, y: node.y + v.y * l }, { x: node.x + v.x * reach, y: node.y + v.y * reach }, ls, ref);
              if (len > reach && touchesArcElsewhere(arc, end, tail(len))) {
                let [a2, b2] = [reach, len];
                for (let k = 0; k < 14; k++) {
                  const mid = (a2 + b2) / 2;
                  if (touchesArcElsewhere(arc, end, tail(mid))) b2 = mid;
                  else a2 = mid;
                }
                len = reach + (a2 - reach) * 0.95;
              }
            } else len = lo * 0.95;
          }
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
            joined.nearOther++;
            return;
          }
          const straight = testWall(wid('s'), far, node, ls, ref);
          // Touching the arc again away from the node is a second junction too (an X or a T, which the
          // engine now makes: spec part 6), not modelled by this L oracle: skipped, counted.
          if (!spilling && touchesArcElsewhere(arc, end, straight)) {
            joined.skipped++;
            joined.touches++;
            return;
          }
          const walls = [arc, straight];
          const kinds = geometry(walls).warnings.map((w) => w.kind);
          // The spec decides: the L between the arc's end segment and the wall (§5.2: an arc joins as
          // its chain of straight segments) warns exactly when the straight L would (§7.1, §10:
          // 'overlap'). Any other warning is the engine failing a join the spec says to make.
          const corner = arcCorner(arc, end, straight, 'end');
          // Where the L made with the end segment reaches over the next segments, the engine carries it
          // on, and the coverage below checks those segments' bodies.
          if (corner === 'overlap') {
            expect(kinds.length, `spec warns: ${JSON.stringify(walls)}`).toBeGreaterThan(0);
            joined.warned++;
            return;
          }
          expect(kinds, `spec makes this L: ${JSON.stringify(walls)}`).toEqual([]);
          joined.clean++;
          if (spilling) joined.spill++;
          const tip = 10 * Math.max(arc.thickness, straight.thickness) + 0.1;
          // Past the end segment the arc goes on and the wall abuts it there: what of the wall pokes past
          // the arc is not kept (tBeyond, as for a T, spec §7.2).
          const c = coverage(walls, node, tip, s, corner, tBeyond(arc, straight, 'end'));
          expect({ o: c.overlaps, g: c.gaps, e: c.extras }, `${JSON.stringify(walls)} at ${JSON.stringify(c.firstBad)}`).toEqual({ o: 0, g: 0, e: 0 });
        },
      ),
      { numRuns: 100, seed },
    );
  });

  // Not vacuous: most runs make the L and are checked point by point, the L reaching past the end
  // segment among them; few are skipped as a second junction. The fixed seed gives 95 clean (29 of
  // them past the end segment), 0 warned, 5 skipped of 100 (a wall passing near the arc's other end;
  // 3 of them also past the end segment).
  // The warnings the spec asks for are the hand cases in arc-corner.test.ts.
  it('checks enough joins', () => {
    console.log(`arc L: ${joined.clean} clean (${joined.spill} past the end segment), ${joined.warned} warned, ${joined.skipped} skipped (${joined.nearOther} near the other end, ${joined.touches} touching)`);
    expect(joined.clean).toBeGreaterThan(40);
    expect(joined.spill).toBeGreaterThan(20);
    expect(joined.skipped).toBeLessThanOrEqual(5);
  });
});

// A straight wall ending inside an arc's band, from outside or from inside, at an angle: a T against
// the arc, over as many segments as it reaches (footprint.ts: spreadOverArc). Around the end, strictly:
// inside a body or in what the T fills up to the arc's face (tFill), one piece; elsewhere, none. Its
// other end near the arc would be a second junction, which this does not model: skipped, counted.
const tees = { clean: 0, warned: 0, skipped: 0 };
describe('a straight wall abutting an arc', () => {
  it('joins exactly, or warns', () => {
    fc.assert(
      fc.property(arcArb, num(0.2, 0.8), num(-0.8, 0.8), fc.boolean(), num(-50, 50), num(1, 3), layersArb, refArb, (arc, f, depth, outside, deg, len, ls, ref) => {
        const c = circleOf(arc);
        const [ra, rb] = faceRadii(arc, c);
        const [rIn, rOut] = [Math.min(ra, rb), Math.max(ra, rb)];
        const ang = c.a0 + c.sweep * f;
        const radial = { x: Math.cos(ang), y: Math.sin(ang) };
        const rEnd = (rIn + rOut) / 2 + ((rOut - rIn) / 2) * depth;
        const end = { x: c.cx + radial.x * rEnd, y: c.cy + radial.y * rEnd };
        const a = (deg * Math.PI) / 180;
        const out = outside ? radial : { x: -radial.x, y: -radial.y };
        const dir = { x: out.x * Math.cos(a) - out.y * Math.sin(a), y: out.x * Math.sin(a) + out.y * Math.cos(a) };
        const start = { x: end.x + dir.x * len, y: end.y + dir.y * len };
        const wall = testWall(wid('t'), start, end, ls, ref);
        const rect = rectOf(wall);
        if (distanceToSegments(arc, start) < 0.2) {
          tees.skipped++;
          return;
        }
        const walls = [arc, wall];
        const g = geometry(walls);
        if (g.warnings.length > 0) {
          tees.warned++;
          return;
        }
        tees.clean++;
        const polys = walls.flatMap((w) => (g.pieces.get(w.id) ?? []).map((p) => p.polygon));
        const bodies = [...arcBody(arc), rect];
        const fill = tFill(arc, wall);
        const beyond = tBeyond(arc, wall);
        const arcBodies = arcBody(arc);
        const reach = Math.max(arc.thickness, wall.thickness) * 3 + 0.1;
        for (let i = 0; i < 800; i++) {
          const t = (i * 2.399963) % (2 * Math.PI);
          const rr = reach * Math.sqrt((i + 0.5) / 800);
          const p = { x: end.x + rr * Math.cos(t), y: end.y + rr * Math.sin(t) };
          if (bodies.some((b) => nearSide(b, p))) continue;
          const count = polys.filter((q) => inside(q, p)).length;
          const want = arcBodies.some((b) => inside(b, p)) || (inside(rect, p) && !beyond(p)) || fill(p) ? 1 : 0;
          expect(count, `${JSON.stringify(walls)} at ${JSON.stringify(p)}`).toBe(want);
        }
      }),
      { numRuns: 100, seed },
    );
  });

  it('checks enough Ts', () => {
    console.log(`arc T: ${tees.clean} clean, ${tees.warned} warned, ${tees.skipped} skipped`);
    expect(tees.clean).toBeGreaterThan(80);
    expect(tees.skipped).toBeLessThanOrEqual(5);
  });
});

/** Within a hair of a body's side: a sample there could fall either way. */
function nearSide(b: readonly { x: number; y: number }[], p: { x: number; y: number }): boolean {
  return b.some((a, i) => {
    const q = b[(i + 1) % b.length]!;
    const ab = { x: q.x - a.x, y: q.y - a.y };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
    return Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t) < 1e-7;
  });
}

// A straight wall crossing an arc anywhere in its band, at a slant (spec 6, Crossing): the thicker core
// passes, the other is cut on both sides. Around the crossing, strictly: inside either body, exactly one
// piece; outside, none. A crossing near the arc's free end is a T or a corner there: skipped, counted.
const crosses = { clean: 0, skipped: 0, noRoom: 0, nearEnds: 0, shortArc: 0, endsOnArc: 0 };
describe('a straight wall crossing an arc', () => {
  it('crosses exactly', () => {
    fc.assert(
      fc.property(arcArb, num(0, 1), num(-0.8, 0.8), num(-60, 60), num(0.5, 2), layersArb, refArb, (arc, u, depth, deg, half0, ls, ref) => {
        const c = circleOf(arc);
        const [ra, rb] = faceRadii(arc, c);
        // Where along the arc: within the stretch far enough from both its ends to be a crossing, not a
        // T or a corner there; an arc with no such stretch is skipped, counted.
        const wallT = ls.reduce((t, l) => t + l.thickness, 0);
        // Closer to an end than both thicknesses, the wall's band reaches the arc's end cap.
        const clearArc = (arc.thickness + wallT) / (c.r * Math.abs(c.sweep));
        if (clearArc >= 0.5) {
          crosses.skipped++;
          crosses.shortArc++;
          return;
        }
        // An arc of a large sweep has its two ends close together: a crossing near one end along the
        // arc can be near the other across the gap. Moved toward the middle (farthest from both) until
        // it is clear of both by the two thicknesses.
        const pointAt = (g: number) => ({ x: c.cx + c.r * Math.cos(c.a0 + c.sweep * g), y: c.cy + c.r * Math.sin(c.a0 + c.sweep * g) });
        const clearOfEnds = (g: number) => [arc.start, arc.end].every((e) => Math.hypot(e.x - pointAt(g).x, e.y - pointAt(g).y) >= arc.thickness + wallT);
        let f = clearArc + (1 - 2 * clearArc) * u;
        for (let k = 0; k < 20 && !clearOfEnds(f); k++) f = 0.5 + (f - 0.5) * 0.8;
        const ang = c.a0 + c.sweep * f;
        const radial = { x: Math.cos(ang), y: Math.sin(ang) };
        const r = (ra + rb) / 2 + (Math.abs(rb - ra) / 2) * depth;
        const at = { x: c.cx + radial.x * r, y: c.cy + radial.y * r };
        const a = (deg * Math.PI) / 180;
        const dir = { x: radial.x * Math.cos(a) - radial.y * Math.sin(a), y: radial.x * Math.sin(a) + radial.y * Math.cos(a) };
        // Each half of the wall stops halfway between leaving the arc's band and meeting it again, so its
        // ends stay off the arc (a second junction there); out of the band (which counts the wall's own
        // thickness), or skipped.
        const [rIn, rOut] = [Math.min(ra, rb), Math.max(ra, rb)];
        const pad = Math.max(...ls.map((l) => l.thickness)) * ls.length;
        const inBand = (s: number, sign: number) => {
          const rr = Math.hypot(at.x + dir.x * s * sign - c.cx, at.y + dir.y * s * sign - c.cy);
          return rr >= rIn - pad && rr <= rOut + pad;
        };
        const span = (sign: number) => {
          let s = 0;
          while (s < 3 && inBand(s, sign)) s += 0.005;
          const out = s;
          while (s < 3 && !inBand(s, sign)) s += 0.005;
          return { out, limit: s >= 3 ? Infinity : (out + s) / 2 };
        };
        const [fwd, bwd] = [span(1), span(-1)];
        const half = Math.min(half0, fwd.limit, bwd.limit);
        if (half <= Math.max(fwd.out, bwd.out)) {
          crosses.skipped++;
          crosses.noRoom++;
          return;
        }
        const wall = testWall(wid('x'), { x: at.x - dir.x * half, y: at.y - dir.y * half }, { x: at.x + dir.x * half, y: at.y + dir.y * half }, ls, ref);
        const rect = rectOf(wall);
        // Near the arc's ends, or its own ends on the arc: not a crossing there.
        const ends = [arc.start, arc.end];
        if (ends.some((e) => Math.hypot(e.x - at.x, e.y - at.y) < arc.thickness + wall.thickness)) {
          crosses.skipped++;
          crosses.nearEnds++;
          return;
        }
        if (distanceToSegments(arc, wall.start) <= SPEC_POINT_TOL || distanceToSegments(arc, wall.end) <= SPEC_POINT_TOL) {
          crosses.skipped++;
          crosses.endsOnArc++;
          return;
        }
        const walls = [arc, wall];
        const g = geometry(walls);
        // The spec makes every X (6, Crossing): a warning here is the engine failing it.
        expect(g.warnings, JSON.stringify(walls)).toEqual([]);
        crosses.clean++;
        const polys = walls.flatMap((w) => (g.pieces.get(w.id) ?? []).map((p) => p.polygon));
        const bodies = [...arcBody(arc), rect];
        const reach = Math.max(arc.thickness, wall.thickness) * 3 + 0.1;
        for (let i = 0; i < 800; i++) {
          const t = (i * 2.399963) % (2 * Math.PI);
          const rr = reach * Math.sqrt((i + 0.5) / 800);
          const p = { x: at.x + rr * Math.cos(t), y: at.y + rr * Math.sin(t) };
          if (bodies.some((b) => nearSide(b, p))) continue;
          const count = polys.filter((q) => inside(q, p)).length;
          expect(count, `${JSON.stringify(walls)} at ${JSON.stringify(p)}`).toBe(bodies.some((b) => inside(b, p)) ? 1 : 0);
        }
      }),
      { numRuns: 100, seed },
    );
  });

  it('checks enough Xs', () => {
    console.log(`arc X: ${crosses.clean} clean, ${crosses.skipped} skipped (${crosses.shortArc} arc too short, ${crosses.noRoom} no room past the band, ${crosses.nearEnds} near an end, ${crosses.endsOnArc} its ends on the arc)`);
    expect(crosses.clean).toBeGreaterThan(80);
    expect(crosses.skipped).toBeLessThanOrEqual(5);
  });
});
