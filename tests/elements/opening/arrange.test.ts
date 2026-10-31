// Aligned openings and distributed groups, by hand. Positions are stations along the host's
// reference line from its start, jamb to jamb.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { createStore } from '../../../src/core/store';
import {
  alignHeads,
  placementProblem,
  alignCandidates,
  ruleKeepingPosition,
  alignOpenings,
  deleteElements,
  distributeOpenings,
  setGroupSpacing,
  ungroupOpenings,
  updateOpening,
} from '../../../src/elements/opening/commands';
import { deriveOpenings, hostsOf } from '../../../src/elements/opening/derive';
import { newOpening, type PositionRule } from '../../../src/elements/opening/schema';
import type { WallId } from '../../../src/elements/wall/schema';
import { gid, lid, oid, tid, wid } from '../../ids';
import type { OpeningId } from '../../../src/elements/opening/schema';

const wall = (id: WallId, a: [number, number], b: [number, number], extra: Partial<DocWall> = {}): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
  ...extra,
});

const win = (id: OpeningId, wallId: WallId, rule: PositionRule) => newOpening(id, wallId, 'window', rule);
const door = (id: OpeningId, wallId: WallId, rule: PositionRule) => newOpening(id, wallId, 'door', rule);

const docOf = (walls: DocWall[], openings: ReturnType<typeof win>[], extra: Partial<Doc> = {}): Doc => ({ ...newDocument(), walls, openings, ...extra });

const placed = (doc: Doc) => deriveOpenings(doc.openings, hostsOf(doc), doc.openingGroups).placed;
const startOf = (doc: Doc, id: OpeningId) => placed(doc).get(id)!.start;
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

// w runs (0,0)→(6,0); v is parallel 3 m away, (0,3)→(6,3); r is v reversed, (6,3)→(0,3).
const w = wall(wid('w'), [0, 0], [6, 0]);
const v = wall(wid('v'), [0, 3], [6, 3]);
const r = wall(wid('r'), [6, 3], [0, 3]);
// The reference: a 1.20 window on w from 1.00 to 2.20, centre 1.60.
const ref = win(oid('a'), wid('w'), { kind: 'fromStart', distance: 1 });

describe('aligned with another opening', () => {
  it('centres across: a 0.90 door on the parallel wall goes from 1.15 to 2.05', () => {
    const d = docOf([w, v], [ref, door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })]);
    near(startOf(d, oid('b')), 1.15);
    expect(placed(d).get(oid('b'))!.valid).toBe(true);
  });

  it('on a wall drawn the other way, stations count from its own start: centre 6 − 1.60 = 4.40', () => {
    const d = docOf([w, r], [ref, door(oid('b'), wid('r'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })]);
    near(startOf(d, oid('b')), 4.4 - 0.45);
  });

  it('by edge: its start jamb lines up with the reference jamb nearer its own wall start', () => {
    // On r the reference jambs fall at stations 5.00 and 3.80: the lower one is 3.80.
    const d = docOf([w, r], [ref, door(oid('b'), wid('r'), { kind: 'aligned', openingId: oid('a'), edge: 'start' })]);
    near(startOf(d, oid('b')), 3.8);
    const e = docOf([w, r], [ref, door(oid('b'), wid('r'), { kind: 'aligned', openingId: oid('a'), edge: 'end' })]);
    near(startOf(e, oid('b')), 5 - 0.9);
  });

  it('follows the reference: moving it to 2.00 moves the aligned one too', () => {
    const d = docOf([w, v], [ref, door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })]);
    const moved = updateOpening(oid('a'), { rule: { kind: 'fromStart', distance: 2 } }).apply(d);
    near(startOf(moved, oid('b')), 2.6 - 0.45);
  });

  it('a missing reference, a loop, or a curved host is a bad reference: centred, with the warning', () => {
    const missing = docOf([w, v], [door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('nope'), edge: 'center' })]);
    near(startOf(missing, oid('b')), (6 - 0.9) / 2);
    expect(placed(missing).get(oid('b'))!.warnings).toContain('openingBadReference');
    const loop = docOf(
      [w, v],
      [win(oid('a'), wid('w'), { kind: 'aligned', openingId: oid('b'), edge: 'center' }), door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })],
    );
    expect(placed(loop).get(oid('a'))!.warnings).toContain('openingBadReference');
    expect(placed(loop).get(oid('b'))!.warnings).toContain('openingBadReference');
    const arc = docOf([w, { ...v, bulge: 0.2 }], [ref, door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })]);
    expect(placed(arc).get(oid('b'))!.warnings).toContain('openingBadReference');
  });

  it('the align command aligns the others to the first, skips ones on its own wall, and refuses loops', () => {
    const d = docOf([w, v], [ref, win(oid('s'), wid('w'), { kind: 'fromEnd', distance: 0.5 }), door(oid('b'), wid('v'), { kind: 'centered' })]);
    const next = alignOpenings(oid('a'), [oid('s'), oid('b')], 'center').apply(d);
    expect(next.openings.find((o) => o.id === 'b')!.rule).toEqual({ kind: 'aligned', openingId: oid('a'), edge: 'center' });
    expect(next.openings.find((o) => o.id === 's')!.rule).toEqual({ kind: 'fromEnd', distance: 0.5 });
    // a already aligned to b: aligning b to a would loop, so nothing changes.
    expect(alignOpenings(oid('b'), [oid('a')], 'center').apply(next)).toBe(next);
  });

  it('deleting the reference keeps the aligned opening where it was, from its wall start', () => {
    const d = docOf([w, v], [ref, door(oid('b'), wid('v'), { kind: 'aligned', openingId: oid('a'), edge: 'center' })]);
    const next = deleteElements(['a']).apply(d);
    const rule = next.openings[0]!.rule;
    expect(rule.kind).toBe('fromStart');
    near(rule.kind === 'fromStart' ? rule.distance : NaN, 1.15);
  });
});

describe('distributed groups', () => {
  // Three 1.20 windows on the 6 m wall, anywhere to begin with.
  const three = () =>
    docOf([w], [win(oid('x'), wid('w'), { kind: 'fromEnd', distance: 0.1 }), win(oid('y'), wid('w'), { kind: 'fromStart', distance: 0 }), win(oid('z'), wid('w'), { kind: 'centered' })]);

  it('equal spaces: (6 − 3 × 1.20) / 4 = 0.60 between the wall ends and each window, in wall order', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }).apply(three());
    // y was first along the wall, then z, then x.
    expect(d.openingGroups).toEqual([{ id: 'g', wallId: wid('w'), members: ['y', 'z', 'x'], spacing: { kind: 'equal' } }]);
    near(startOf(d, oid('y')), 0.6);
    near(startOf(d, oid('z')), 2.4);
    near(startOf(d, oid('x')), 4.2);
    expect([...placed(d).values()].every((p) => p.valid)).toBe(true);
  });

  it('the spaces follow the wall: on an 8 m wall they become 1.10', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }).apply(three());
    const long = { ...d, walls: [{ ...w, end: { x: 8, y: 0 } }] };
    near(startOf(long, oid('y')), 1.1);
    near(startOf(long, oid('x')), 1.1 * 3 + 2.4);
  });

  it('fixed spacing of 0.50: the row of 4.60 is centred, or measured from either end', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'fixed', gap: 0.5, anchor: 'centered', distance: 0 }).apply(three());
    near(startOf(d, oid('y')), 0.7);
    near(startOf(d, oid('z')), 2.4);
    near(startOf(d, oid('x')), 4.1);
    const fromStart = setGroupSpacing(gid('g'), { kind: 'fixed', gap: 0.5, anchor: 'start', distance: 0.2 }).apply(d);
    near(startOf(fromStart, oid('y')), 0.2);
    near(startOf(fromStart, oid('x')), 3.6);
    const fromEnd = setGroupSpacing(gid('g'), { kind: 'fixed', gap: 0.5, anchor: 'end', distance: 0.3 }).apply(d);
    near(startOf(fromEnd, oid('y')), 6 - 0.3 - 4.6);
  });

  it('needs two or more openings on one wall; otherwise nothing changes', () => {
    const d = docOf([w, v], [win(oid('x'), wid('w'), { kind: 'centered' }), win(oid('y'), wid('v'), { kind: 'centered' })]);
    expect(distributeOpenings(gid('g'), [oid('x'), oid('y')], { kind: 'equal' }).apply(d)).toBe(d);
    expect(distributeOpenings(gid('g'), [oid('x')], { kind: 'equal' }).apply(d)).toBe(d);
  });

  it('ungrouping keeps every window where it is', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }).apply(three());
    const loose = ungroupOpenings(gid('g')).apply(d);
    expect(loose.openingGroups).toEqual([]);
    for (const id of [oid('x'), oid('y'), oid('z')]) near(startOf(loose, id), startOf(d, id));
    expect(loose.openings.every((o) => o.rule.kind === 'fromStart')).toBe(true);
  });

  // Spread again without it, the others all jumped when one was dragged (the user's report).
  it('a member given another rule undoes the group; the others stay exactly where they were', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }).apply(three());
    const [y, z] = [startOf(d, oid('y')), startOf(d, oid('z'))];
    const next = updateOpening(oid('x'), { rule: { kind: 'fromEnd', distance: 0 } }).apply(d);
    expect(next.openingGroups).toEqual([]);
    expect(next.openings.filter((o) => o.rule.kind === 'inGroup')).toEqual([]);
    near(startOf(next, oid('y')), y);
    near(startOf(next, oid('z')), z);
  });

  it('a group left with one member is dissolved and that member stays where it was', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y')], { kind: 'equal' }).apply(three());
    const before = startOf(d, oid('y'));
    const next = deleteElements(['x']).apply(d);
    expect(next.openingGroups).toEqual([]);
    expect(next.openings.find((o) => o.id === 'y')!.rule.kind).toBe('fromStart');
    near(startOf(next, oid('y')), before);
  });

  it('deleting the wall deletes its groups', () => {
    const d = distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }).apply(three());
    const next = deleteElements(['w']).apply(d);
    expect(next.openings).toEqual([]);
    expect(next.openingGroups).toEqual([]);
  });

  it('each command is one undo step', () => {
    const s = createStore<Doc>(three());
    s.dispatch(distributeOpenings(gid('g'), [oid('x'), oid('y'), oid('z')], { kind: 'equal' }));
    s.dispatch(setGroupSpacing(gid('g'), { kind: 'fixed', gap: 0.5, anchor: 'centered', distance: 0 }));
    s.undo();
    expect(s.get().openingGroups[0]!.spacing).toEqual({ kind: 'equal' });
    s.undo();
    expect(s.get().openingGroups).toEqual([]);
  });

  it('a member with no group that lists it is a bad reference: centred, with the warning', () => {
    const d = docOf([w], [win(oid('x'), wid('w'), { kind: 'inGroup', groupId: gid('gone') })]);
    near(startOf(d, oid('x')), 2.4);
    expect(placed(d).get(oid('x'))!.warnings).toContain('openingBadReference');
  });
});

describe('align heads', () => {
  it('windows take the top of the first selected; a door keeps its sill at 0 and changes height', () => {
    // a: sill 1.00 + 1.20 → top 2.20.
    const d = docOf([w, v], [ref, { ...win(oid('s'), wid('w'), { kind: 'fromEnd', distance: 0.5 }), height: 0.6 }, door(oid('b'), wid('v'), { kind: 'centered' })]);
    const next = alignHeads(oid('a'), [oid('s'), oid('b')]).apply(d);
    const s = next.openings.find((o) => o.id === 's')!;
    const b = next.openings.find((o) => o.id === 'b')!;
    near(s.sill, 1.6);
    near(b.sill, 0);
    near(b.height, 2.2);
  });

  it('measured from each wall base: a wall raised 0.30 gets a sill 0.30 lower', () => {
    const raised = { ...v, baseOffset: 0.3 };
    const d = docOf([w, raised], [ref, win(oid('s'), wid('v'), { kind: 'centered' })]);
    near(alignHeads(oid('a'), [oid('s')]).apply(d).openings.find((o) => o.id === 's')!.sill, 0.7);
  });
});

describe('placing and invalid openings', () => {
  it('an opening over another, or that does not fit, is refused with the reason', () => {
    const d = docOf([w], [win(oid('a'), wid('w'), { kind: 'fromStart', distance: 1 })]);
    expect(placementProblem(d, win(oid('n'), wid('w'), { kind: 'fromStart', distance: 1.5 }))).toBe('openingOverlap');
    expect(placementProblem(d, { ...win(oid('n'), wid('w'), { kind: 'fromEnd', distance: 0 }), width: 7 })).toBe('openingOutside');
    expect(placementProblem(d, win(oid('n'), wid('w'), { kind: 'fromEnd', distance: 0.5 }))).toBeNull();
  });
});

describe('aligned: only to openings it can face', () => {
  // w runs (0,0)→(6,0). s runs (8,3)→(14,3), parallel, entirely beyond w's end; a door on s at 1.00.
  const s = wall(wid('s'), [8, 3], [14, 3]);
  const far = door(oid('f'), wid('s'), { kind: 'fromStart', distance: 1 });

  it('a reference whose projection falls outside the wall is not offered, and the command refuses it', () => {
    const d = docOf([w, s, v], [win(oid('a'), wid('w'), { kind: 'centered' }), far, door(oid('b'), wid('v'), { kind: 'fromStart', distance: 1 })]);
    const offered = alignCandidates(d, oid('a')).map((o) => o.id);
    expect(offered).toContain('b');
    expect(offered).not.toContain('f');
    expect(alignOpenings(oid('f'), [oid('a')], 'center').apply(d)).toBe(d);
    expect(ruleKeepingPosition(d, oid('a'), 'aligned', oid('f'))).toBeNull();
  });
});
