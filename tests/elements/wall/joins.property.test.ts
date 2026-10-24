// Spike gate (docs/wall-joins-spec.md §15): 2000 random scenes against the independent oracle.
// FUZZ_SEED picks a different seed; FUZZ_SCALE multiplies the run counts (nightly: 10).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeWallGeometry } from '../../../src/elements/wall/geometry/footprint';
import type { Wall } from '../../../src/elements/wall/schema';
import { checkAgainst, expectedL, expectedRoom, expectedT, frameOf, nearFace, type Region } from './oracle';
import { crossedScene, lScene, type Mode, roomScene, tScene } from './scenes';

const seed = Number(process.env.FUZZ_SEED ?? 20261024);
const scale = Number(process.env.FUZZ_SCALE ?? 1);
const runs = (n: number) => ({ numRuns: n * scale, seed });
const TIMEOUT = 600_000;

function expectExact(walls: readonly Wall[], region: Region, sampleSeed: number): void {
  const r = checkAgainst(walls, region, sampleSeed);
  const where = r.firstBad ? ` first at (${r.firstBad.x}, ${r.firstBad.y})` : '';
  expect({ overlaps: r.overlaps, gaps: r.gaps, extras: r.extras }, `${JSON.stringify(walls)}${where}`).toEqual({
    overlaps: 0,
    gaps: 0,
    extras: 0,
  });
  expect(r.areaError, JSON.stringify(walls)).toBeLessThan(1e-9);
}

const dump = (walls: readonly Wall[]) => JSON.stringify([...computeWallGeometry(walls).pieces].sort());

describe.each<Mode>(['normal', 'degenerate'])('L, %s', (mode) => {
  it('covers exactly the spec region, or warns wallsOverlap', () => {
    fc.assert(
      fc.property(lScene(mode), fc.nat(), ({ a, aEnd, b, bEnd }, sampleSeed) => {
        const walls = [a, b];
        const region = expectedL(a, aEnd, b, bEnd);
        const kinds = computeWallGeometry(walls).warnings.map((w) => w.kind);
        if (region === 'overlap') {
          expect(kinds).toEqual(['wallsOverlap']);
          return;
        }
        expect(kinds).toEqual([]);
        expectExact(walls, region, sampleSeed);
      }),
      runs(400),
    );
  }, TIMEOUT);
});

describe.each<Mode>(['normal', 'degenerate'])('T, %s', (mode) => {
  it('covers exactly the spec region and never crosses the near face', () => {
    fc.assert(
      fc.property(tScene(mode), fc.nat(), ({ host, abutting, end }, sampleSeed) => {
        const walls = [host, abutting];
        const g = computeWallGeometry(walls);
        expect(g.warnings).toEqual([]);
        expectExact(walls, expectedT(abutting, end, host), sampleSeed);

        // I6: no vertex of the abutting wall lies past the near face, beyond float rounding.
        const face = nearFace(abutting, end, host);
        const fh = frameOf(host);
        const facePoint = { x: host.start.x + fh.n.x * face.offset, y: host.start.y + fh.n.y * face.offset };
        const limit = face.inward.x * facePoint.x + face.inward.y * facePoint.y;
        for (const v of g.pieces.get(abutting.id)!.flat()) {
          expect(face.inward.x * v.x + face.inward.y * v.y - limit).toBeGreaterThanOrEqual(-1e-12);
        }
      }),
      runs(300),
    );
  }, TIMEOUT);
});

describe('corner whose ends overran each other', () => {
  it('resolves as one L at the crossing of the reference lines, never as two Ts', () => {
    fc.assert(
      fc.property(crossedScene(), fc.nat(), ({ a, aEnd, b, bEnd, node }, sampleSeed) => {
        const walls = [a, b];
        const region = expectedL(a, aEnd, b, bEnd, node);
        const kinds = computeWallGeometry(walls).warnings.map((w) => w.kind);
        if (region === 'overlap') {
          expect(kinds).toEqual(['wallsOverlap']);
          return;
        }
        expect(kinds).toEqual([]);
        expectExact(walls, region, sampleSeed);
      }),
      runs(300),
    );
  }, TIMEOUT);
});

describe('room with a divider', () => {
  it('covers exactly the spec region and does not depend on input order', () => {
    fc.assert(
      fc.property(roomScene(), fc.nat(), fc.nat(), (s, sampleSeed, shuffle) => {
        const walls = [...s.ring, s.divider];
        const g = computeWallGeometry(walls);
        expect(g.warnings).toEqual([]);
        expectExact(walls, expectedRoom(s.ring, s.ringEnds, s.divider, s.startHost, s.endHost), sampleSeed);

        // I4: a different input order gives bit-identical output.
        const shuffled = [...walls].sort((x, y) => ((x.id.charCodeAt(1) * 31 + shuffle) % 7) - ((y.id.charCodeAt(1) * 31 + shuffle) % 7));
        expect(dump(shuffled)).toBe(dump(walls));
      }),
      runs(300),
    );
  }, TIMEOUT);
});
