// A guardrail along a stair's or a ramp's side: it follows the side's handrail line, its feet rising
// with the steps or the slope; a stair with its handrails off still has its sides; the guardrail round
// the well is still offered when the sides have theirs.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { type RailingSolid, railingKind } from '../../src/elements/kinds/railing';
import { postsOf, type Railing } from '../../src/elements/railing/schema';
import { stairSolid } from '../../src/elements/stair/geometry';
import { RAIL_HEIGHT, type Stair } from '../../src/elements/stair/schema';
import { lid } from '../ids';

const upper = { id: lid('lvl_up'), name: 'Upper', elevation: 2.8, height: 2.8 };
const stair = (kind: Stair['kind'], extra: Partial<Stair> = {}): Stair => ({
  id: 'stair_s',
  levelId: lid('lvl_ground'),
  kind,
  at: { x: 0, y: 0 },
  angle: Math.PI / 2,
  width: 1,
  tread: 0.28,
  turn: 'left',
  ...extra,
});
const side = (n: number): Railing => ({ id: `railing_${n}`, levelId: lid('lvl_ground'), points: [{ x: 9, y: 9 }, { x: 10, y: 9 }], height: 1.1, baseOffset: 0, host: { stairId: 'stair_s', side: n }, infill: 'balusters' });
const docOf = (s: Stair, railings: Railing[]): Doc => ({ ...newDocument(), levels: [...newDocument().levels, upper], stairs: [s], railings });
const solidOf = (doc: Doc, id: string) => deriveGeometry(doc).kinds.get('railings')!.get(id) as RailingSolid;

describe("a guardrail along a stair's side", () => {
  it("follows the side's handrail line, its feet at the nosing, rising to the top", () => {
    const s = stair('straight');
    const lines = stairSolid(s, 2.8, 0).sides;
    expect(lines).toHaveLength(2);
    const r = solidOf(docOf(s, [side(0)]), 'railing_0');
    expect(r.points).toEqual(lines[0]!.map((p) => ({ x: p.x, y: p.y })));
    expect(r.rise).toBeDefined();
    const rise = r.rise!;
    expect(rise[0]).toBeCloseTo(0, 9);
    // From the first nosing to the top one: the whole height less a riser.
    expect(rise.at(-1)! + r.bottom).toBeCloseTo(lines[0]!.at(-1)!.z - RAIL_HEIGHT, 9);
    for (let i = 1; i < rise.length; i++) expect(rise[i]!).toBeGreaterThanOrEqual(rise[i - 1]! - 1e-9);
    // Its top above the highest foot by its height.
    const span = railingKind.span!(r);
    expect(span.top).toBeCloseTo(r.bottom + rise.at(-1)! + 1.1, 9);
  });

  it("its posts' feet rise with it, between the points too", () => {
    const r = solidOf(docOf(stair('straight'), [side(1)]), 'railing_1');
    const posts = postsOf(r);
    expect(posts.length).toBeGreaterThan(2);
    expect(posts[0]!.z).toBeCloseTo(0, 9);
    expect(posts.at(-1)!.z).toBeCloseTo(r.rise!.at(-1)!, 9);
    for (let i = 1; i < posts.length; i++) expect(posts[i]!.z).toBeGreaterThanOrEqual(posts[i - 1]!.z - 1e-9);
  });

  it('a ramp gets one rising with its slope', () => {
    const r = solidOf(docOf(stair('ramp'), [side(0)]), 'railing_0');
    expect(r.rise!.at(-1)!).toBeGreaterThan(1);
  });

  it('a stair with its handrails off still has its sides', () => {
    const s = stair('straight', { railing: false });
    const solid = stairSolid(s, 2.8, 0);
    expect(solid.rails).toHaveLength(0);
    expect(solid.sides).toHaveLength(2);
    expect(solidOf(docOf(s, [side(0)]), 'railing_0').rise).toBeDefined();
  });

  it("a side that is not there leaves it where it was put; one without a side is the well's", () => {
    const lost = solidOf(docOf(stair('straight'), [side(7)]), 'railing_7');
    expect(lost.rise).toBeUndefined();
    expect(lost.points).toEqual([{ x: 9, y: 9 }, { x: 10, y: 9 }]);
    expect(railingKind.valid({ ...side(0), host: { stairId: 'stair_s', side: -1 } })).toBe(false);
    expect(railingKind.valid({ ...side(0), host: { stairId: 'stair_s', side: 0.5 } })).toBe(false);
    expect(railingKind.valid(side(0))).toBe(true);
  });
});
