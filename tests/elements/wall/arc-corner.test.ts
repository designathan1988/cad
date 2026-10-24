// The case recorded as an open defect (docs/wall-joins-spec.md, part 6): a 1 cm arc with a 1 cm
// straight wall at 30° at its start. The sampling oracle flagged a gap; the gap was the end of the arc
// sticking out past the straight wall's outer face, which an acute L trims (spec §7.1). Here the
// joined pieces are checked against the spec's L near the node, densely.

import { describe, expect, it } from 'vitest';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { arcCorner, coverage, intoOf } from './oracle-arc';

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
