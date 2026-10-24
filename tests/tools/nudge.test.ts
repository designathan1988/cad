// Moving the selection from the keyboard (ref/chat.txt:242): the arrows move it by a step, 5 cm (the
// snap grid), 1 cm with Alt. Walls move with their joins, openings slide along their wall, room points
// and floor outlines move, and rooms whose walls all move go along.

import { describe, expect, it } from 'vitest';
import { arrowStep, nudge } from '../../src/tools/nudge';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { deriveOpenings, hostsOf } from '../../src/elements/opening/derive';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

const doc: Doc = {
  ...newDocument(),
  walls: [wall('b', [0, 0], [4, 0]), wall('r', [4, 0], [4, 3]), wall('t', [4, 3], [0, 3]), wall('l', [0, 3], [0, 0])],
  openings: [
    newOpening('d', 'b', 'door', { kind: 'fromStart', distance: 1 }),
    newOpening('w', 't', 'window', { kind: 'fromEnd', distance: 0.5 }),
    newOpening('c', 'r', 'window', { kind: 'centered' }),
  ],
  rooms: [{ id: 'room', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Room 1', number: '1' }],
  floors: [{ id: 'f', levelId: 'lvl_ground', source: { kind: 'outline', points: [{ x: 6, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 1 }] }, thickness: 0.1, offset: 0 }],
};
const start = (d: Doc, id: string) => deriveOpenings(d.openings, hostsOf(d), d.openingGroups).placed.get(id)!.start;
const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 9);

describe('arrow steps', () => {
  it('5 cm, or 1 cm with Alt; up is +y in the plan', () => {
    expect(arrowStep('ArrowRight', false)).toEqual({ x: 0.05, y: 0 });
    expect(arrowStep('ArrowUp', true)).toEqual({ x: 0, y: 0.01 });
    expect(arrowStep('ArrowDown', false)).toEqual({ x: 0, y: -0.05 });
    expect(arrowStep('a', false)).toBeNull();
  });
});

describe('nudging the selection', () => {
  it('a wall: moves, its corners follow', () => {
    const next = nudge(doc, deriveGeometry(doc), ['l'], { x: -0.01, y: 0 });
    expect(next.walls.find((w) => w.id === 'l')!.start).toEqual({ x: -0.01, y: 3 });
    expect(next.walls.find((w) => w.id === 'b')!.start).toEqual({ x: -0.01, y: 0 });
  });

  it('a door: slides along its wall by the step along it, whatever its rule', () => {
    near(start(nudge(doc, deriveGeometry(doc), ['d'], { x: 0.05, y: 0 }), 'd'), 1.05);
    // Across the wall: no slide.
    expect(nudge(doc, deriveGeometry(doc), ['d'], { x: 0, y: 0.05 })).toBe(doc);
    // The top wall runs from x = 4 to x = 0: right is backwards along it.
    const w0 = start(doc, 'w');
    near(start(nudge(doc, deriveGeometry(doc), ['w'], { x: 0.05, y: 0 }), 'w'), w0 - 0.05);
    // A centred one keeps where it goes: measured from the start from now on.
    const c0 = start(doc, 'c');
    const moved = nudge(doc, deriveGeometry(doc), ['c'], { x: 0, y: 0.01 });
    near(start(moved, 'c'), c0 + 0.01);
    expect(moved.openings.find((o) => o.id === 'c')!.rule.kind).toBe('fromStart');
  });

  it('a member of a distributed group stays where its group puts it', () => {
    const grouped = { ...doc, openings: [{ ...doc.openings[0]!, rule: { kind: 'inGroup' as const, groupId: 'g' } }] };
    expect(nudge(grouped, deriveGeometry(grouped), ['d'], { x: 0.05, y: 0 })).toBe(grouped);
  });

  it("a room's point and an outline floor move by the step", () => {
    const next = nudge(doc, deriveGeometry(doc), ['room', 'f'], { x: 0.05, y: 0 });
    near(next.rooms[0]!.seed.x, 2.05);
    const pts = next.floors[0]!.source.kind === 'outline' ? next.floors[0]!.source.points : [];
    near(pts[0]!.x, 6.05);
  });

  it('every wall of the room: the room goes along', () => {
    const next = nudge(doc, deriveGeometry(doc), ['b', 'r', 't', 'l'], { x: 0, y: 0.05 });
    near(next.rooms[0]!.seed.y, 1.55);
  });
});
