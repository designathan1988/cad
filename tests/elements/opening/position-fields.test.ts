// An opening's position in the panel reads as the plan's dimensions do: from the face of the wall
// beside it when one meets its wall on that side (the tester's run of 2026-10-25: the panel said
// "4,68 from the wall start" while the plan said 0,10 from the partition).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { leafFields, positionFields } from '../../../src/elements/opening/fields';
import { newOpening } from '../../../src/elements/opening/schema';
import { fieldStates } from '../../../src/ui/fields';
import { wid } from '../../ids';
import type { WallId } from '../../../src/elements/wall/schema';
import { oid } from '../../ids';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

// A 6 m wall, a 20 cm partition at x = 3 (faces 2.90 and 3.10), a door 0.50 past it.
const doc = (): Doc => ({
  ...newDocument(),
  walls: [wall(wid('h'), [0, 0], [6, 0]), wall(wid('p'), [3, 0], [3, 3])],
  openings: [newOpening(oid('o'), wid('h'), 'door', { kind: 'fromStart', distance: 3.6 })],
});

const fieldsOf = (d: Doc, update: (patch: unknown) => void = () => {}) => {
  const g = deriveGeometry(d);
  const one = g.openings.get(oid('o'))!;
  const act = { update: (_: unknown, patch: unknown) => update(patch), setRule: () => {}, align: () => {}, alignHeads: () => {}, distribute: () => {}, setSpacing: () => {}, ungroup: () => {} };
  return fieldStates(positionFields(d, one, g.openings, act), [one]);
};

describe('position in the panel', () => {
  it('from the start, past a partition: named for the wall beside it, where it lies on the plan (the wall runs +x: on the left), the distance from its face', () => {
    const states = fieldsOf(doc());
    const rule = states.find((s) => s.field.id === 'rule')!;
    const options = (rule.field as Extract<typeof rule.field, { options: unknown }>).options;
    expect(options.find((x) => x.value === 'fromStart')!.label).toBe('Wall on the left');
    expect(states.find((s) => s.field.id === 'distance')!.value).toBeCloseTo(0.5, 12);
  });

  it('a typed distance is from that face: 0.80 puts the jamb at 3.90', () => {
    const asked: unknown[] = [];
    const states = fieldsOf(doc(), (p) => asked.push(p));
    const f = states.find((s) => s.field.id === 'distance')!.field as Extract<ReturnType<typeof fieldsOf>[number]['field'], { kind: 'number' }>;
    f.set(0.8);
    const r = (asked[0] as { rule: { kind: string; distance: number } }).rule;
    expect(r.kind).toBe('fromStart');
    expect(r.distance).toBeCloseTo(3.9, 12);
  });

  it('with no wall between it and the start: from the wall start, as before', () => {
    const d = { ...doc(), walls: [wall(wid('h'), [0, 0], [6, 0])] };
    const states = fieldsOf(d);
    const rule = states.find((s) => s.field.id === 'rule')!;
    const options = (rule.field as Extract<typeof rule.field, { options: unknown }>).options;
    expect(options.find((x) => x.value === 'fromStart')!.label).toBe('Wall end on the left');
    expect(states.find((s) => s.field.id === 'distance')!.value).toBeCloseTo(3.6, 12);
  });
});

describe("a door's sides in the panel", () => {
  it('named by the room on each side, the other "outside"; with no rooms, left and right', () => {
    // A closed 4 × 3 box with the door in its bottom wall (drawn left to right: its left is inside).
    const box: Doc = {
      ...newDocument(),
      walls: [wall(wid('a'), [0, 0], [4, 0]), wall(wid('b'), [4, 0], [4, 3]), wall(wid('c'), [4, 3], [0, 3]), wall(wid('d'), [0, 3], [0, 0])],
      openings: [newOpening(oid('o'), wid('a'), 'door', { kind: 'centered' })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Kitchen', number: '1' }],
    };
    const g = deriveGeometry(box);
    const one = g.openings.get(oid('o'))!;
    const labels = (rooms: Parameters<typeof leafFields>[2]) => {
      const swing = fieldStates(leafFields(one, () => {}, rooms), [one]).find((s) => s.field.id === 'swing')!;
      return (swing.field as Extract<typeof swing.field, { options: unknown }>).options.map((x) => x.label);
    };
    expect(labels([...g.rooms.values()])).toEqual(['Kitchen', 'Outside']);
    expect(labels([])).toEqual(['Left', 'Right']);
  });
});

describe("a door's hinge in the panel", () => {
  it('left and right as seen from the room it opens to, facing it, with a note saying from where', () => {
    // The door in the bottom wall (drawn +x), opening into the box (+y). Standing inside facing the
    // wall (south), the right hand points west: the start jamb (x small) is on the right.
    const box: Doc = {
      ...newDocument(),
      walls: [wall(wid('a'), [0, 0], [4, 0]), wall(wid('b'), [4, 0], [4, 3]), wall(wid('c'), [4, 3], [0, 3]), wall(wid('d'), [0, 3], [0, 0])],
      openings: [{ ...newOpening(oid('o'), wid('a'), 'door', { kind: 'centered' }), swing: 'left' }],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Kitchen', number: '1' }],
    };
    const g = deriveGeometry(box);
    const one = g.openings.get(oid('o'))!;
    const states = fieldStates(leafFields(one, () => {}, [...g.rooms.values()]), [one]);
    const hinge = states.find((s) => s.field.id === 'hinge')!;
    expect((hinge.field as Extract<typeof hinge.field, { options: unknown }>).options).toEqual([
      { value: 'end', label: 'Left' },
      { value: 'start', label: 'Right' },
    ]);
    const note = states.find((s) => s.field.id === 'hingeSeen')!;
    expect((note.field as Extract<typeof note.field, { kind: 'note' }>).text([one])).toBe('As seen from Kitchen, facing the door');
    // Opening outward, seen from outside: the start jamb is on the left now.
    const out = { ...one, opening: { ...one.opening, swing: 'right' as const } };
    const flipped = fieldStates(leafFields(out, () => {}, [...g.rooms.values()]), [out]).find((s) => s.field.id === 'hinge')!;
    expect((flipped.field as Extract<typeof flipped.field, { options: unknown }>).options).toEqual([
      { value: 'start', label: 'Left' },
      { value: 'end', label: 'Right' },
    ]);
  });
});

describe('centring an opening between the walls beside it', () => {
  it("in the middle of its room's stretch: between the partition's face (3.10) and the wall's end (6)", () => {
    // The door at 3.60–4.50 on a 6 m wall, the partition's far face at 3.10: the middle is 4.55, so its
    // start goes to 4.10.
    const asked: unknown[] = [];
    const states = fieldsOf(doc(), (p) => asked.push(p));
    const f = states.find((s) => s.field.id === 'centerBetween')!.field as Extract<ReturnType<typeof fieldsOf>[number]['field'], { kind: 'action' }>;
    expect(f.enabled?.([])).toBe(true);
    f.run();
    const r = (asked[0] as { rule: { kind: string; distance: number } }).rule;
    expect(r.kind).toBe('fromStart');
    expect(r.distance).toBeCloseTo((3.1 + 6) / 2 - 0.45, 12);
  });
});
