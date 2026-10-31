// A distributed group keeps to the stretch of wall its openings were in: between the joints (T or X)
// just outside them, or the wall's ends. So distributing never puts an opening over a joint the
// openings were clear of (the tester's CK65 → CK66: two windows left of an X, one landed on it).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { hostsIn } from '../../../src/project/derived-queries';
import { deleteElements, distributeOpenings, setGroupSpacing } from '../../../src/elements/opening/commands';
import { deriveOpenings } from '../../../src/elements/opening/derive';
import { newOpening, type Opening, type PositionRule } from '../../../src/elements/opening/schema';
import { CURRENT_VERSION, readProject } from '../../../src/project/file';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});
// 0.60 wide windows on w, a 6 m wall along x on its centre line, 20 cm thick.
const win = (id: string, rule: PositionRule): Opening => ({ ...newOpening(id, 'w', 'window', rule), width: 0.6 });
const w = wall('w', [0, 0], [6, 0]);
// c crosses w at x = 3 (an X); t meets it there from above (a T). Either covers w from 2.90 to 3.10.
const c = wall('c', [3, -2], [3, 2]);
const t = wall('t', [3, 0], [3, 2]);
const left = [win('x', { kind: 'fromStart', distance: 0.2 }), win('y', { kind: 'fromStart', distance: 0.9 }), win('z', { kind: 'fromStart', distance: 1.6 })];
const right = [win('x', { kind: 'fromEnd', distance: 0.2 }), win('y', { kind: 'fromEnd', distance: 0.9 }), win('z', { kind: 'fromEnd', distance: 1.6 })];
const docOf = (walls: DocWall[], openings: Opening[]): Doc => ({ ...newDocument(), walls, openings });

const startOf = (doc: Doc, id: string) => deriveOpenings(doc.openings, hostsIn(doc), doc.openingGroups).placed.get(id)!.start;
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);
const clean = (doc: Doc) => [...deriveGeometry(doc).openings.values()].every((o) => o.valid && o.warnings.length === 0);

describe('a group distributed beside a joint', () => {
  for (const [name, other] of [
    ['an X', c],
    ['a T', t],
  ] as const) {
    it(`three windows left of ${name}: equal spaces between the wall start and the joint, (2.90 − 1.80) / 4 = 0.275`, () => {
      const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, other], left));
      expect(d.openingGroups[0]!.between).toEqual([null, other.id]);
      near(startOf(d, 'x'), 0.275);
      near(startOf(d, 'y'), 1.15);
      near(startOf(d, 'z'), 2.025);
      expect(clean(d)).toBe(true);
    });
  }

  it('two left of the X and three right: spread over the wall one would land on it, so a group for each side', () => {
    // Over the whole wall: (6 − 5 × 0.6) / 6 = 0.5 spaces put the third at 2.70 to 3.30, on the X.
    const five = [
      win('x', { kind: 'fromStart', distance: 0.2 }),
      win('y', { kind: 'fromStart', distance: 0.9 }),
      win('z', { kind: 'fromEnd', distance: 1.6 }),
      win('v', { kind: 'fromEnd', distance: 0.9 }),
      win('u', { kind: 'fromEnd', distance: 0.2 }),
    ];
    const d = distributeOpenings('g', ['x', 'y', 'z', 'v', 'u'], { kind: 'equal' }).apply(docOf([w, c], five));
    expect(d.openingGroups.map((g) => [g.id, g.members, g.between])).toEqual([
      ['g', ['x', 'y'], [null, 'c']],
      ['g-2', ['z', 'v', 'u'], ['c', null]],
    ]);
    // Left: (2.90 − 1.20) / 3; right, from 3.10: (2.90 − 1.80) / 4 = 0.275.
    near(startOf(d, 'x'), 1.7 / 3);
    near(startOf(d, 'y'), (1.7 / 3) * 2 + 0.6);
    near(startOf(d, 'z'), 3.375);
    near(startOf(d, 'v'), 4.25);
    near(startOf(d, 'u'), 5.125);
    expect(clean(d)).toBe(true);
  });

  it('two left of the X and one right: over the wall the second would land on it (1.05 spaces), so the two spread on their side and the one stays', () => {
    const three = [win('x', { kind: 'fromStart', distance: 0.2 }), win('y', { kind: 'fromStart', distance: 0.9 }), win('z', { kind: 'fromEnd', distance: 0.9 })];
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, c], three));
    expect(d.openingGroups.map((g) => g.members)).toEqual([['x', 'y']]);
    near(startOf(d, 'z'), 4.5);
    expect(d.openings.find((o) => o.id === 'z')!.rule).toEqual({ kind: 'fromEnd', distance: 0.9 });
  });

  it('right of the X: between the joint and the wall end, from 3.10', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, c], right));
    expect(d.openingGroups[0]!.between).toEqual(['c', null]);
    // Wall order: z (at 3.80) first, then y, then x.
    near(startOf(d, 'z'), 3.375);
    near(startOf(d, 'y'), 4.25);
    near(startOf(d, 'x'), 5.125);
    expect(clean(d)).toBe(true);
  });

  it('the stretch follows the joint: c moved to x = 2.5 leaves 0 to 2.40, spaces of 0.15', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, c], left));
    const moved = { ...d, walls: [w, wall('c', [2.5, -2], [2.5, 2])] };
    near(startOf(moved, 'x'), 0.15);
    near(startOf(moved, 'z'), 0.15 * 3 + 1.2);
  });

  it('fixed spacing is measured from the stretch: anchored at its end, the row ends at the joint', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, c], left));
    const fixed = setGroupSpacing('g', { kind: 'fixed', gap: 0.1, anchor: 'end', distance: 0 }).apply(d);
    near(startOf(fixed, 'z') + 0.6, 2.9);
    expect(fixed.openingGroups[0]!.between).toEqual([null, 'c']);
  });

  it('a group from before stretches (version 3) gets one when its spacing is changed: it stays clear of the X', () => {
    // The tester's F12: made before the fix, switched from fixed back to equal, it landed on the X.
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'fixed', gap: 0.1, anchor: 'start', distance: 0.2 }).apply(docOf([w, c], left));
    const old: Doc = { ...d, openingGroups: d.openingGroups.map(({ between: _b, ...g }) => g) };
    const equal = setGroupSpacing('g', { kind: 'equal' }).apply(old);
    expect(equal.openingGroups[0]!.between).toEqual([null, 'c']);
    near(startOf(equal, 'x'), 0.275);
    expect(clean(equal)).toBe(true);
  });

  it('a real version 3 file, read as the app reads it: equal again after fixed stays clear of the X', () => {
    // As saved before the fix: version 3, the group with fixed spacing and no stretch.
    const v3 = JSON.stringify({
      ...newDocument(),
      version: 3,
      walls: [w, c],
      openings: left.map((o) => ({ ...o, rule: { kind: 'inGroup', groupId: 'g' } })),
      openingGroups: [{ id: 'g', wallId: 'w', members: ['x', 'y', 'z'], spacing: { kind: 'fixed', gap: 0.1, anchor: 'start', distance: 0.2 } }],
    });
    const read = readProject(v3);
    if (!read.ok) throw new Error(read.error);
    // Read as the current version (the groups are as in 4).
    expect(read.doc.version).toBe(CURRENT_VERSION);
    expect(read.doc.openingGroups[0]!.between).toBeUndefined();
    // Read, its ids are typed (io/typed-ids.ts): the group is group_g, the crossing wall wall_c.
    const equal = setGroupSpacing('group_g', { kind: 'equal' }).apply(read.doc);
    expect(equal.openingGroups[0]!.between).toEqual([null, 'wall_c']);
    expect(clean(equal)).toBe(true);
  });

  it('with the bounding wall gone, the group takes the whole wall again', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w, c], left));
    const gone = deleteElements(['c']).apply(d);
    near(startOf(gone, 'x'), (6 - 1.8) / 4);
  });

  it('a version 3 file whose group already sits a window on the X: read, it is spread by stretch, clear of it', () => {
    // Three 0.60 windows spread over the whole 6 m wall: 1.05 spaces put y from 2.70 to 3.30, on the X.
    const v3 = JSON.stringify({
      ...newDocument(),
      version: 3,
      walls: [w, c],
      openings: left.map((o) => ({ ...o, rule: { kind: 'inGroup', groupId: 'g' } })),
      openingGroups: [{ id: 'g', wallId: 'w', members: ['x', 'y', 'z'], spacing: { kind: 'equal' } }],
    });
    const before = readProject(v3.replace('"version":3', '"version":4'));
    if (!before.ok) throw new Error(before.error);
    // As version 4 (no migration) it sits on the X, as the tester saw.
    expect(clean(before.doc)).toBe(false);
    const read = readProject(v3);
    if (!read.ok) throw new Error(read.error);
    expect(clean(read.doc)).toBe(true);
    // y's middle is on the X's (3.00): it goes with z, to the right; x, alone on the left, stays at 1.05.
    // Ids typed on reading (io/typed-ids.ts).
    expect(read.doc.openingGroups.map((g) => [g.members, g.between])).toEqual([[['opening_y', 'opening_z'], ['wall_c', null]]]);
    near(startOf(read.doc, 'opening_x'), 1.05);
    near(startOf(read.doc, 'opening_y'), 3.1 + 1.7 / 3);
  });

  it('openings on both sides of the X: no joint outside them, so the whole wall, as before', () => {
    const both = [win('x', { kind: 'fromStart', distance: 0.5 }), win('y', { kind: 'fromEnd', distance: 0.5 })];
    const d = distributeOpenings('g', ['x', 'y'], { kind: 'equal' }).apply(docOf([w, c], both));
    expect(d.openingGroups[0]!.between).toBeUndefined();
    near(startOf(d, 'x'), (6 - 1.2) / 3);
  });

  it('a wall with no joint inside it: no stretch recorded, the group is as before', () => {
    const d = distributeOpenings('g', ['x', 'y', 'z'], { kind: 'equal' }).apply(docOf([w], left));
    expect(d.openingGroups[0]!.between).toBeUndefined();
    near(startOf(d, 'x'), 1.05);
  });
});
