// An opening's position in the panel reads as the plan's dimensions do: from the face of the wall
// beside it when one meets its wall on that side (the tester's run of 2026-10-25: the panel said
// "4,68 from the wall start" while the plan said 0,10 from the partition).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/app/document';
import { deriveGeometry } from '../../../src/app/geometry';
import { leafFields, positionFields } from '../../../src/elements/opening/fields';
import { newOpening } from '../../../src/elements/opening/schema';
import { fieldStates } from '../../../src/ui/fields';

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

// A 6 m wall, a 20 cm partition at x = 3 (faces 2.90 and 3.10), a door 0.50 past it.
const doc = (): Doc => ({
  ...newDocument(),
  walls: [wall('h', [0, 0], [6, 0]), wall('p', [3, 0], [3, 3])],
  openings: [newOpening('o', 'h', 'door', { kind: 'fromStart', distance: 3.6 })],
});

const fieldsOf = (d: Doc, update: (patch: unknown) => void = () => {}) => {
  const g = deriveGeometry(d);
  const one = g.openings.get('o')!;
  const act = { update: (_: unknown, patch: unknown) => update(patch), setRule: () => {}, align: () => {}, alignHeads: () => {}, distribute: () => {}, setSpacing: () => {}, ungroup: () => {} };
  return fieldStates(positionFields(d, one, g.openings, act), [one]);
};

describe('position in the panel', () => {
  it('from the start, past a partition: named for the wall beside it, the distance from its face', () => {
    const states = fieldsOf(doc());
    const rule = states.find((s) => s.field.id === 'rule')!;
    const options = (rule.field as Extract<typeof rule.field, { options: unknown }>).options;
    expect(options.find((x) => x.value === 'fromStart')!.label).toBe('From wall at start');
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
    const d = { ...doc(), walls: [wall('h', [0, 0], [6, 0])] };
    const states = fieldsOf(d);
    const rule = states.find((s) => s.field.id === 'rule')!;
    const options = (rule.field as Extract<typeof rule.field, { options: unknown }>).options;
    expect(options.find((x) => x.value === 'fromStart')!.label).toBe('From wall start');
    expect(states.find((s) => s.field.id === 'distance')!.value).toBeCloseTo(3.6, 12);
  });
});

describe("a door's sides in the panel", () => {
  it('named by the room on each side, the other "outside"; with no rooms, left and right', () => {
    // A closed 4 × 3 box with the door in its bottom wall (drawn left to right: its left is inside).
    const box: Doc = {
      ...newDocument(),
      walls: [wall('a', [0, 0], [4, 0]), wall('b', [4, 0], [4, 3]), wall('c', [4, 3], [0, 3]), wall('d', [0, 3], [0, 0])],
      openings: [newOpening('o', 'a', 'door', { kind: 'centered' })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Kitchen', number: '1' }],
    };
    const g = deriveGeometry(box);
    const one = g.openings.get('o')!;
    const labels = (rooms: Parameters<typeof leafFields>[2]) => {
      const swing = fieldStates(leafFields(one, () => {}, rooms), [one]).find((s) => s.field.id === 'swing')!;
      return (swing.field as Extract<typeof swing.field, { options: unknown }>).options.map((x) => x.label);
    };
    expect(labels([...g.rooms.values()])).toEqual(['Kitchen', 'Outside']);
    expect(labels([])).toEqual(['Left', 'Right']);
  });
});
