// The case recorded as an open defect (docs/wall-joins-spec.md, part 6): a 1 cm arc with a 1 cm
// straight wall at 30° at its start. The sampling oracle flagged a gap; the gap was the end of the arc
// sticking out past the straight wall's outer face, which an acute L trims (spec §7.1). Here the
// joined pieces are checked against the spec's L near the node, densely.

import { describe, expect, it } from 'vitest';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { arcCorner, coverage, distanceToSegments, intoOf, touchesArcElsewhere } from './oracle-arc';

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
// arc) that the engine refused with arcJoinUnsupported. None is the single L the spec says to make:
// the straight wall's far end lies within POINT_TOLERANCE (1 mm) of one of the arc's segments, a
// second junction (spec §6: a T there). Control: with that end pulled back 5 mm, out of reach, each
// L joins and covers exactly.
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
    it(`${name}: the far end is within 1 mm of the arc, so a second junction, and warns`, () => {
      expect(distanceToSegments(arc, straight.start)).toBeLessThanOrEqual(1e-3);
      expect(geometry([arc, straight]).warnings.map((w) => w.kind)).toEqual(['arcJoinUnsupported']);
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
