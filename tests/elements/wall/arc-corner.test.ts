// The case recorded as an open defect (docs/wall-joins-spec.md, part 6): a 1 cm arc with a 1 cm
// straight wall at 30° at its start. The sampling oracle flagged a gap; the gap was the end of the arc
// sticking out past the straight wall's outer face, which an acute L trims (spec §7.1). Here the
// joined pieces are checked against the spec's L near the node, densely.

import { describe, expect, it } from 'vitest';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { arcBody, arcCorner, coverage, distanceToSegments, intoOf, segmentWall, segmentsOf, tBeyond, tFill, touchesArcElsewhere } from './oracle-arc';
import { inside, rectOf } from './oracle';
import { cornerJoin } from './oracle-x';

const refs = ['interiorFace', 'centerline', 'exteriorFace'] as const;

describe('a thin arc and a thin wall at 30°', () => {
  for (const ref of refs)
    for (const sref of refs)
      for (const left of [true, false]) {
        it(`${ref} arc, ${sref} wall, ${left ? 'left' : 'right'}: exactly the spec's L at the node`, () => {
          const arc = { ...testWall('arc', { x: 0, y: 0 }, { x: 1, y: 0 }, [layer(0.01)], ref), bulge: 0.0437 } as Wall;
          const u = intoOf(arc, 'start');
          const a = ((left ? 30 : -30) * Math.PI) / 180;
          const v = { x: u.x * Math.cos(a) - u.y * Math.sin(a), y: u.x * Math.sin(a) + u.y * Math.cos(a) };
          const straight = testWall('s', v, { x: 0, y: 0 }, [layer(0.01)], sref);
          expect(geometry([arc, straight]).warnings).toEqual([]);
          const corner = arcCorner(arc, 'start', straight, 'end');
          if (corner === 'overlap') throw new Error('the spec makes this L');
          for (let seed = 1; seed <= 20; seed++) {
            const c = coverage([arc, straight], { x: 0, y: 0 }, 0.2, seed, corner);
            expect({ o: c.overlaps, g: c.gaps, e: c.extras }, JSON.stringify(c.firstBad)).toEqual({ o: 0, g: 0, e: 0 });
          }
        });
      }
});

// A butt L at an arc's end where the straight wall goes through and the arc abuts: the straight
// wall's body still reaches the segments before the end one, which take the cut as an arc stem in a
// T (footprint.ts). Found by the property suite with thick walls; refused with arcJoinUnsupported
// before.
describe('a butt L at an arc end, the arc abutting, reaching the next segments', () => {
  it("joined: exactly the spec's L at the node and each body once past it", () => {
    const arc = {
      ...testWall('arc', { x: 0, y: -0.002418685132927909 }, { x: 1.9657386191438864, y: -0.002418685132927909 }, [layer(0.1300514413688485), layer(0.12397633477858412)], 'centerline'),
      bulge: 3.1137465367314023,
    } as Wall;
    const straight = testWall('s', { x: -0.27900427372874276, y: 2.734447151892815 }, arc.start, [layer(0.14062467906004392), layer(0.1315533212302238), layer(0.0850371252577269)], 'exteriorFace');
    const walls = [arc, straight];
    expect(geometry(walls).warnings).toEqual([]);
    const corner = arcCorner(arc, 'start', straight, 'end');
    if (corner === 'overlap') throw new Error('the spec makes this L');
    expect(touchesArcElsewhere(arc, 'start', straight)).toBe(false);
    for (let seed = 1; seed <= 10; seed++) {
      const c = coverage(walls, arc.start, 10 * straight.thickness + 0.1, seed, corner);
      expect({ o: c.overlaps, g: c.gaps, e: c.extras }, JSON.stringify(c.firstBad)).toEqual({ o: 0, g: 0, e: 0 });
    }
  });
});

// Four candidates from a search over angles (miter at either end, and a thinner wall abutting a thick
// arc). Each has two junctions: the L at the node, and its far end within POINT_TOLERANCE (1 mm) of
// one of the arc's segments, a T there (spec §6). Once refused with arcJoinUnsupported; since the T
// against an arc spreads over the segments it reaches (footprint.ts), both are made, and both are
// checked here: the L by the spec's corner near the node, the T strictly near the far end (arc body,
// the wall's own less what is past the arc, and what the T fills up to the face). Control: with that
// end pulled back 5 mm, out of reach, the L alone joins and covers exactly.
const thick = (ts: number[]) => ts.map((t) => layer(t));
const arcA = { ...testWall('arc', { x: 0, y: 0 }, { x: 1.8146952434908599, y: 0 }, thick([0.07645804060623049, 0.059247538475319744, 0.04780983394011855]), 'exteriorFace'), bulge: -2.3791327284977184 } as Wall;
const arcB = { ...testWall('arc', { x: 0, y: 0 }, { x: 1.2304911367828026, y: 0 }, thick([0.11508156635798514, 0.11388237481936812]), 'exteriorFace'), bulge: -3.316613919545999 } as Wall;
const arcC = { ...testWall('arc', { x: 0, y: 0 }, { x: 2.722073347074911, y: 0 }, thick([0.10026307996362448]), 'centerline'), bulge: -1.2379008897940864 } as Wall;
const twoJunctions: [string, Wall, Wall, 'start' | 'end'][] = [
  ['miter at the start', arcA, testWall('s', { x: 0.2643777941779525, y: 1.9824490868482854 }, arcA.start, arcA.layers, 'exteriorFace'), 'start'],
  ['miter at the end', arcB, testWall('s', { x: 0.967451917499866, y: 1.9826271381979577 }, arcB.end, arcB.layers, 'interiorFace'), 'end'],
  ['a thin wall abuts the arc', arcB, testWall('s', { x: 0.967451917499866, y: 1.9826271381979577 }, arcB.end, [layer(0.0946182446410622, 'finish1')], 'interiorFace'), 'end'],
  ['a thinner wall abuts a long arc', arcC, testWall('s', { x: 1.5503501696018507, y: 1.6208222590316421 }, arcC.end, [layer(0.032392485841842844, 'finish1')], 'interiorFace'), 'end'],
];

describe('candidates whose far end also meets the arc', () => {
  for (const [name, arc, straight, end] of twoJunctions) {
    it(`${name}: the far end is within 1 mm of the arc, a second junction; both joins are exact`, () => {
      expect(distanceToSegments(arc, straight.start)).toBeLessThanOrEqual(1e-3);
      const walls = [arc, straight];
      const g = geometry(walls);
      expect(g.warnings).toEqual([]);
      const polys = walls.flatMap((w) => g.pieces.get(w.id)!.map((p) => p.polygon));
      const disc = (at: { x: number; y: number }, reach: number, want: (p: { x: number; y: number }) => number) => {
        let bad = 0;
        for (let i = 0; i < 3000; i++) {
          const t = (i * 2.399963) % (2 * Math.PI);
          const r = reach * Math.sqrt((i + 0.5) / 3000);
          const p = { x: at.x + r * Math.cos(t), y: at.y + r * Math.sin(t) };
          if (polys.filter((q) => inside(q, p)).length !== want(p)) bad++;
        }
        return bad;
      };
      const bodies = [...arcBody(arc), rectOf(straight)];
      const node = end === 'start' ? arc.start : arc.end;
      const corner = arcCorner(arc, end, straight, 'end');
      if (corner === 'overlap') throw new Error('the spec makes this L');
      expect(disc(node, 0.6, (p) => (corner.applies(p) ? (corner.region.contains(p) ? 1 : 0) : bodies.some((b) => inside(b, p)) ? 1 : 0))).toBe(0);
      const fill = tFill(arc, straight, 'start');
      const beyond = tBeyond(arc, straight, 'start');
      const own = arcBody(arc);
      const rect = rectOf(straight);
      expect(disc(straight.start, 0.5, (p) => (own.some((b) => inside(b, p)) || (inside(rect, p) && !beyond(p)) || fill(p) ? 1 : 0))).toBe(0);
    });
    it(`${name}: with the far end 5 mm back, the L alone joins exactly`, () => {
      const node = end === 'start' ? arc.start : arc.end;
      const d = { x: node.x - straight.start.x, y: node.y - straight.start.y };
      const l = Math.hypot(d.x, d.y);
      const moved = { ...straight, start: { x: straight.start.x + (d.x / l) * 0.005, y: straight.start.y + (d.y / l) * 0.005 } };
      expect(distanceToSegments(arc, moved.start)).toBeGreaterThan(1e-3);
      const walls = [arc, moved];
      expect(geometry(walls).warnings).toEqual([]);
      const corner = arcCorner(arc, end, moved, 'end');
      if (corner === 'overlap') throw new Error('the spec makes this L');
      expect(touchesArcElsewhere(arc, end, moved)).toBe(false);
      for (let seed = 1; seed <= 5; seed++) {
        const c = coverage(walls, node, 10 * Math.max(arc.thickness, moved.thickness) + 0.1, seed, corner);
        expect({ o: c.overlaps, g: c.gaps, e: c.extras }, JSON.stringify(c.firstBad)).toEqual({ o: 0, g: 0, e: 0 });
      }
    });
  }
});

// The arc's end segment is not free at its joint with the next one: the arc goes on there, so the L's
// corner may reach past it, up to the arc's real far end (spec §7.1, "ponta livre", clarified
// 2026-10-24 by §5.2). Here an arc of 88 segments of 10.7 cm and walls 40 and 60 cm thick at 100° and
// 140°: the corner reaches past the end segment, and the L is made and is exactly the spec's.
// Control: under the old rule (the end segment free at its own far end) the same corner is refused.
const longArc = { ...testWall('arc', { x: 0, y: 0 }, { x: 6, y: 0 }, [layer(0.2)]), bulge: -1 } as Wall;
const leaving = (deg: number, t: number) => {
  const a = (deg * Math.PI) / 180;
  return testWall('s', { x: -2 * Math.sin(a), y: 2 * Math.cos(a) }, { x: 0, y: 0 }, [layer(t)]);
};

describe("an L whose corner reaches past the arc's end segment", () => {
  for (const t of [0.4, 0.6])
    for (const deg of [100, 140]) {
      it(`${t * 100} cm wall at ${deg}°: joined, exactly the spec's L`, () => {
        const straight = leaving(deg, t);
        const walls = [longArc, straight];
        expect(geometry(walls).warnings).toEqual([]);
        const corner = arcCorner(longArc, 'start', straight, 'end');
        if (corner === 'overlap') throw new Error('the spec makes this L');
        for (let seed = 1; seed <= 5; seed++) {
          const c = coverage(walls, longArc.start, 10 * t + 0.1, seed, corner, tBeyond(longArc, straight, 'end'));
          expect({ o: c.overlaps, g: c.gaps, e: c.extras }, JSON.stringify(c.firstBad)).toEqual({ o: 0, g: 0, e: 0 });
        }
      });
      it(`${t * 100} cm wall at ${deg}°, control: with the end segment free at its own far end, refused`, () => {
        const seg = segmentWall(longArc, 0);
        expect(segmentsOf(longArc)).toBe(88);
        expect(Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y)).toBeCloseTo(0.107, 3);
        expect(cornerJoin(seg, 'start', leaving(deg, t), 'end').kind).toBe('overlap');
        expect(cornerJoin(seg, 'start', leaving(deg, t), 'end', undefined, { a: 100 }).kind).toBe('miter');
      });
    }
});

// The rule stays whole at the real free ends: the arc's other end, and the straight wall's far end.
describe('an L whose corner passes a real free end', () => {
  it("a 10 cm arc and a 50 cm wall: the corner passes the arc's other end, no join, a warning", () => {
    const short = { ...testWall('arc', { x: 0, y: 0 }, { x: 0.1, y: 0 }, [layer(0.05)]), bulge: -0.2 } as Wall;
    const straight = testWall('s', { x: -1.5, y: -1 }, { x: 0, y: 0 }, [layer(0.5)]);
    expect(segmentsOf(short)).toBe(5);
    expect(arcCorner(short, 'start', straight, 'end')).toBe('overlap');
    expect(geometry([short, straight]).warnings.map((w) => w.kind)).toEqual(['wallsOverlap']);
  });
  it("a 30 cm wall 60 cm thick on a long arc: the corner passes the wall's far end, no join, a warning", () => {
    const straight = testWall('s', { x: -0.15, y: 0.26 }, { x: 0, y: 0 }, [layer(0.6)]);
    expect(arcCorner(longArc, 'start', straight, 'end')).toBe('overlap');
    expect(geometry([longArc, straight]).warnings.map((w) => w.kind)).toEqual(['wallsOverlap']);
  });
});
