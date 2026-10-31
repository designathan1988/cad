// Flipping a wall swaps its start and end, so its layers turn to the other side of its reference
// line, as Revit's flip arrows do. Everything hosted stays where it is in the world.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveOpenings, hostsOf } from '../../../src/elements/opening/derive';
import { distributeOpenings } from '../../../src/elements/opening/commands';
import { newOpening } from '../../../src/elements/opening/schema';
import { flipWalls } from '../../../src/elements/wall/flip';
import { oid, wid } from '../../ids';
import type { WallId } from '../../../src/elements/wall/schema';
import type { OpeningId } from '../../../src/elements/opening/schema';
import { gid } from '../../ids';

const wall = (id: WallId, a: [number, number], b: [number, number], extra: Partial<DocWall> = {}): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
  ...extra,
});

// World x of an opening's two jambs on a wall along x.
const jambs = (doc: Doc, id: OpeningId) => {
  const p = deriveOpenings(doc.openings, hostsOf(doc), doc.openingGroups).placed.get(id)!;
  const w = doc.walls.find((x) => x.id === p.opening.wallId)!;
  const dir = Math.sign(w.end.x - w.start.x);
  return [w.start.x + dir * p.start, w.start.x + dir * p.end].sort((a, b) => a - b);
};

describe('flip a wall', () => {
  const base: Doc = {
    ...newDocument(),
    walls: [wall(wid('w'), [0, 0], [6, 0]), wall(wid('arc'), [0, 5], [4, 5], { bulge: 0.3 })],
    openings: [
      newOpening(oid('d'), wid('w'), 'door', { kind: 'fromStart', distance: 1 }, { hinge: 'start', swing: 'left' }),
      newOpening(oid('n'), wid('w'), 'window', { kind: 'fromEnd', distance: 0.5 }),
      newOpening(oid('k'), wid('w'), 'window', { kind: 'fromOpening', openingId: oid('d'), distance: 0.4, toward: 'end' }),
    ],
  };

  it('swaps start and end, and an arc keeps its curve (bulge negated)', () => {
    const f = flipWalls([wid('w'), wid('arc')]).apply(base);
    expect(f.walls[0]).toMatchObject({ start: { x: 6, y: 0 }, end: { x: 0, y: 0 } });
    expect(f.walls[1]).toMatchObject({ start: { x: 4, y: 5 }, end: { x: 0, y: 5 }, bulge: -0.3 });
  });

  it('every opening stays where it was, its rules counted from the other end', () => {
    const f = flipWalls([wid('w')]).apply(base);
    for (const id of [oid('d'), oid('n'), oid('k')]) jambs(f, id).forEach((x, i) => expect(x).toBeCloseTo(jambs(base, id)[i]!, 12));
    expect(f.openings.find((o) => o.id === 'd')!.rule).toEqual({ kind: 'fromEnd', distance: 1 });
    expect(f.openings.find((o) => o.id === 'n')!.rule).toEqual({ kind: 'fromStart', distance: 0.5 });
    expect(f.openings.find((o) => o.id === 'k')!.rule).toEqual({ kind: 'fromOpening', openingId: oid('d'), distance: 0.4, toward: 'start' });
  });

  it('a door keeps its hinge jamb and opens to the same side of the wall', () => {
    const d = flipWalls([wid('w')]).apply(base).openings.find((o) => o.id === 'd')!;
    expect([d.hinge, d.swing]).toEqual(['end', 'right']);
  });

  it('a distributed group keeps its members in place: reversed order, fixed row anchored at the other end', () => {
    const g = distributeOpenings(gid('g'), [oid('d'), oid('n')], { kind: 'fixed', gap: 0.5, anchor: 'start', distance: 0.3 }).apply(base);
    const f = flipWalls([wid('w')]).apply(g);
    expect(f.openingGroups[0]).toMatchObject({ members: ['n', 'd'], spacing: { kind: 'fixed', gap: 0.5, anchor: 'end', distance: 0.3 } });
    for (const id of [oid('d'), oid('n')]) jambs(f, id).forEach((x, i) => expect(x).toBeCloseTo(jambs(g, id)[i]!, 12));
  });

  it('flipping twice gives back the same document', () => {
    expect(flipWalls([wid('w'), wid('arc')]).apply(flipWalls([wid('w'), wid('arc')]).apply(base))).toEqual(base);
  });
});
