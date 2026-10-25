// Spike gate (docs/wall-joins-spec.md §15): 2000 random scenes against the independent oracle.
// FUZZ_SEED picks a different seed; FUZZ_SCALE multiplies the run counts (nightly: 10).

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { geometry, layer, testWall, type TestWall as Wall } from './fixtures';
import { type P, rectOf, shoelace } from './oracle';
import {
  checkAgainst,
  expectedRoom,
  expectedT,
  type Region,
} from './oracle';
import { abutmentPenetration, layerContainmentViolations, layerContinuity, notchFill } from './oracle-layers';
import { buttOwnership, buttPenetration, cornerJoin, crossingOf, expectedCorner, expectedX, sidesOf, throughOf } from './oracle-x';
import { crossedScene, lScene, type Mode, nodeScene, roomScene, tScene, xScene } from './scenes';

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
  expect(layerContainmentViolations(walls), JSON.stringify(walls)).toBe(0);
}

// Each seed tried passes a layer outside the core in ~550 T joints and ~11 000 points.
const PRIORITY_JOINTS = 300;
// The fixed seed checks ~1 400 butt corners; other seeds tried gave 1 300 to 2 800.
const BUTT_CORNERS = 600;
// Points whose layer was checked in those corners' overlap.
const BUTT_POINTS = 20_000;
// The fixed seed checks I10 on 220 stems (stems without finishes on that side have nothing to check).
const NODE_STEMS = 100;
const PRIORITY_POINTS = 5_000;
const notch = { joints: 0, points: 0, priorityJoints: 0, priorityPoints: 0 };
/** I6 by layer and I10, for one T. Counts checked points so I10 cannot pass vacuously. */
function expectAbutment(
  abutting: Wall,
  end: 'start' | 'end',
  host: Wall,
  walls: readonly Wall[],
  s: number,
  keep?: Parameters<typeof abutmentPenetration>[4],
): void {
  expect(abutmentPenetration(abutting, end, host, walls, keep), JSON.stringify(walls)).toBeLessThanOrEqual(1e-12);
  const fill = notchFill(abutting, end, host, walls, s);
  expect(fill.bad, JSON.stringify(walls)).toBe(0);
  if (fill.checked > 0) notch.joints++;
  notch.points += fill.checked;
  if (fill.passedOutsideCore > 0) notch.priorityJoints++;
  notch.priorityPoints += fill.passedOutsideCore;
}

/** Counts how many corners actually had their layer continuity checked, so I9 cannot pass vacuously. */
const continuity = { corners: 0, points: 0 };
function expectContinuous(result: ReturnType<typeof layerContinuity>, walls: readonly Wall[]): void {
  if (result === null) return;
  expect(result.mismatched, JSON.stringify(walls)).toBe(0);
  if (result.checked > 0) continuity.corners++;
  continuity.points += result.checked;
}

/**
 * A corner between different sequences is a butt (§7.1), layer by layer between straight walls: no
 * layer of either wall passes the line it stops on (buttRule), and in the overlap of the two bands
 * each point is the layer the rule gives it. Ownership is skipped when the tip is bevelled: the bevel
 * can remove points the rule alone would keep.
 */
const butt = { corners: 0, points: 0 };
function expectCorner(a: Wall, aEnd: 'start' | 'end', b: Wall, bEnd: 'start' | 'end', walls: readonly Wall[], s: number, node?: P): void {
  const { kind, butt: isButt } = cornerJoin(a, aEnd, b, bEnd, node);
  if (kind !== 'miter' && kind !== 'bevel') return;
  if (!isButt) {
    expectContinuous(layerContinuity(a, aEnd, b, bEnd, node), walls);
    return;
  }
  butt.corners++;
  expect(buttPenetration(a, aEnd, b, bEnd, walls), JSON.stringify(walls)).toBeLessThanOrEqual(1e-12);
  if (kind === 'bevel') return;
  const own = buttOwnership(a, aEnd, b, bEnd, walls, s);
  expect(own.bad, JSON.stringify(walls)).toBe(0);
  butt.points += own.checked;
}

const dump = (walls: readonly Wall[]) => JSON.stringify([...geometry(walls).pieces].sort());

describe.each<Mode>(['normal', 'degenerate'])('L, %s', (mode) => {
  it('covers exactly the spec region, or warns wallsOverlap', () => {
    fc.assert(
      fc.property(lScene(mode), fc.nat(), ({ a, aEnd, b, bEnd }, sampleSeed) => {
        const walls = [a, b];
        const region = expectedCorner(a, aEnd, b, bEnd);
        const kinds = geometry(walls).warnings.map((w) => w.kind);
        if (region === 'overlap') {
          expect(kinds).toEqual(['wallsOverlap']);
          return;
        }
        expect(kinds).toEqual([]);
        expectExact(walls, region, sampleSeed);
        expectCorner(a, aEnd, b, bEnd, walls, sampleSeed);
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
        const g = geometry(walls);
        expect(g.warnings).toEqual([]);
        expectExact(walls, expectedT(abutting, end, host), sampleSeed);

        expectAbutment(abutting, end, host, walls, sampleSeed);
      }),
      runs(300),
    );
  }, TIMEOUT);
});

const crossing = { scenes: 0 };
describe.each<Mode>(['normal', 'degenerate'])('X, %s', (mode) => {
  it('covers both bands exactly; each side of the cut wall behaves as a T', () => {
    fc.assert(
      fc.property(xScene(mode), fc.nat(), ({ a, b }, sampleSeed) => {
        const walls = [a, b];
        expect(geometry(walls).warnings).toEqual([]);
        expectExact(walls, expectedX(a, b), sampleSeed);
        const { through, cut } = throughOf(a, b);
        sidesOf(cut, through, crossingOf(a, b)).forEach((side, k) =>
          expectAbutment(side.abutting, side.end, through, walls, sampleSeed + k, side.keep),
        );
        crossing.scenes++;
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
        const region = expectedCorner(a, aEnd, b, bEnd, node);
        const kinds = geometry(walls).warnings.map((w) => w.kind);
        if (region === 'overlap') {
          expect(kinds).toEqual(['wallsOverlap']);
          return;
        }
        expect(kinds).toEqual([]);
        expectExact(walls, region, sampleSeed);
        expectCorner(a, aEnd, b, bEnd, walls, sampleSeed, node);
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
        const g = geometry(walls);
        expect(g.warnings).toEqual([]);
        expectExact(walls, expectedRoom(s.ring, s.ringEnds, s.divider, s.startHost, s.endHost), sampleSeed);
        expectAbutment(s.divider, 'start', s.startHost, walls, sampleSeed);
        expectAbutment(s.divider, 'end', s.endHost, walls, sampleSeed + 1);
        for (let k = 0; k < 4; k++) {
          const j = (k + 3) % 4;
          expectCorner(s.ring[j]!, s.ringEnds[j]![1], s.ring[k]!, s.ringEnds[k]![0], walls, sampleSeed + 2 + k);
        }

        // I4: a different input order gives bit-identical output.
        const shuffled = [...walls].sort((x, y) => ((x.id.charCodeAt(1) * 31 + shuffle) % 7) - ((y.id.charCodeAt(1) * 31 + shuffle) % 7));
        expect(dump(shuffled)).toBe(dump(walls));
      }),
      runs(300),
    );
  }, TIMEOUT);
});

const node = { scenes: 0, stems: 0 };
describe('node with a passage in line', () => {
  it('covers the passage band and each stem beyond its face; each stem behaves as a T against the passage', () => {
    fc.assert(
      fc.property(nodeScene(), fc.nat(), ({ passage, stems }, sampleSeed) => {
        const walls = [...passage, ...stems.map((s) => s.wall)];
        expect(geometry(walls).warnings, JSON.stringify(walls)).toEqual([]);
        // The passage as one host: the same type drawn head to tail is one straight band.
        const host: Wall = { ...passage[0], id: 'passage', end: passage[1].end };
        const parts = stems.map((s) => expectedT(s.wall, s.end, host));
        const hostArea = shoelace(rectOf(host));
        const region: Region = {
          area: parts.reduce((sum, r) => sum + r.area - hostArea, hostArea),
          contains: (p) => parts.some((r) => r.contains(p)),
          edges: parts.flatMap((r) => r.edges),
        };
        expectExact(walls, region, sampleSeed);
        stems.forEach((s, k) => {
          expect(abutmentPenetration(s.wall, s.end, host, walls), JSON.stringify(walls)).toBeLessThanOrEqual(1e-12);
          const fill = notchFill(s.wall, s.end, host, walls, sampleSeed + k, [passage[0].id, passage[1].id]);
          expect(fill.bad, JSON.stringify(walls)).toBe(0);
          if (fill.checked > 0) node.stems++;
        });
        node.scenes++;
      }),
      runs(300),
    );
  }, TIMEOUT);
});

describe('regressions found by larger runs', () => {
  it('butt against a short through wall (FUZZ_SEED=55555, FUZZ_SCALE=10)', () => {
    // Same type, but b on its exterior face reads its layers reversed from the corner: a butt at 170°
    // against a 0.5 m through wall. I10 once sampled past the through wall's free end.
    const ls = [layer(0.014950893618385329, 'finish1'), layer(0.11960714894708263, 'structure'), layer(0.014950893618385329, 'finish2')];
    const a = testWall('a', { x: 0.5, y: 0 }, { x: 0, y: 0 }, ls);
    const b = testWall('b', { x: -0.49233721039619344, y: 0.08720132601798186 }, { x: 0, y: 0 }, ls, 'exteriorFace');
    const walls = [a, b];
    const region = expectedCorner(a, 'end', b, 'end');
    if (region === 'overlap') throw new Error('expected a join');
    expect(geometry(walls).warnings).toEqual([]);
    expectExact(walls, region, 0);
    expect(cornerJoin(a, 'end', b, 'end').butt).toBe(true);
    expect(buttPenetration(a, 'end', b, 'end', walls)).toBeLessThanOrEqual(1e-12);
    for (let s = 0; s < 20; s++) expect(buttOwnership(a, 'end', b, 'end', walls, s).bad, `sample seed ${s}`).toBe(0);
  });
});

describe('layer checks were really exercised', () => {
  it('checked enough corners and points', () => {
    // Runs after the suites above in file order.
    console.log(`I9 checked on ${continuity.corners} corners, ${continuity.points} points`);
    expect(continuity.corners).toBeGreaterThan(300 * scale);
    expect(continuity.points).toBeGreaterThan(30_000 * scale);
    console.log(`I10 checked on ${notch.joints} T joints, ${notch.points} points`);
    expect(notch.joints).toBeGreaterThan(300 * scale);
    expect(notch.points).toBeGreaterThan(20_000 * scale);
    console.log(`priority: a layer outside the core passed host layers in ${notch.priorityJoints} T joints, ${notch.priorityPoints} points`);
    expect(notch.priorityJoints).toBeGreaterThan(PRIORITY_JOINTS * scale);
    expect(notch.priorityPoints).toBeGreaterThan(PRIORITY_POINTS * scale);
    expect(crossing.scenes).toBe(600 * scale);
    console.log(`node scenes: ${node.scenes}, stems with I10 checked: ${node.stems}`);
    expect(node.scenes).toBe(300 * scale);
    expect(node.stems).toBeGreaterThan(NODE_STEMS * scale);
    console.log(`butt corners checked layer by layer: ${butt.corners}, ${butt.points} points`);
    expect(butt.corners).toBeGreaterThan(BUTT_CORNERS * scale);
    expect(butt.points).toBeGreaterThan(BUTT_POINTS * scale);
  });
});
