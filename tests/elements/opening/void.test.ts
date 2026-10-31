// The void, by hand: plan areas of the cut pieces and the volume of the 3D blocks. A wall from (0, 0)
// to (4, 0), concrete 20 cm on its axis, ground floor 2.80 m high: 0.80 m² in plan, 2.24 m³.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { area } from '../../../src/elements/wall/geometry/convex';
import { newOpening, type Opening } from '../../../src/elements/opening/schema';
import { insidePolygon } from '../../../src/project/derive';
import { wid } from '../../ids';
import type { WallId } from '../../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number], extra: Partial<DocWall> = {}): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
  ...extra,
});

const docWith = (walls: DocWall[], openings: Opening[]): Doc => ({ ...newDocument(), walls, openings });

function measure(doc: Doc) {
  const g = deriveGeometry(doc);
  let plan = 0;
  let volume = 0;
  let blocks = 0;
  for (const s of g.solids.values()) {
    for (const p of s.pieces) plan += area(p.polygon);
    for (const b of s.blocks) {
      volume += area(b.polygon) * (b.top - b.bottom);
      blocks++;
    }
  }
  /** How many blocks contain the point (x, y) at height z. */
  const cover = (x: number, y: number, z: number) =>
    [...g.solids.values()].flatMap((s) => s.blocks).filter((b) => z > b.bottom && z < b.top && insidePolygon(b.polygon, { x, y })).length;
  return { g, plan, volume, blocks, cover };
}

const W = wall(wid('w'), [0, 0], [4, 0]);

describe('no opening: the wall as before', () => {
  it('one block per piece, from bottom to top', () => {
    const m = measure(docWith([W], []));
    expect(m.plan).toBeCloseTo(0.8, 12);
    expect(m.volume).toBeCloseTo(2.24, 12);
    expect(m.blocks).toBe(1);
  });
});

describe('window: a hole between sill and head', () => {
  // Centred 1.20 × 1.20, sill 1.00: x ∈ [1.4, 2.6], z ∈ [1.0, 2.2].
  const m = measure(docWith([W], [newOpening('o', wid('w'), 'window', { kind: 'centered' })]));

  it('plan: the cut goes through, 0.80 − 1.20 × 0.20 = 0.56 m² in two pieces', () => {
    expect(m.plan).toBeCloseTo(0.56, 12);
    expect(m.g.solids.get(wid('w'))!.pieces).toHaveLength(2);
  });

  it('3D: 2.24 − 1.20 × 0.20 × 1.20 = 1.952 m³', () => {
    expect(m.volume).toBeCloseTo(1.952, 12);
  });

  it('empty in the hole, solid under the sill and over the head, once', () => {
    expect(m.cover(2, 0, 1.5)).toBe(0);
    expect(m.cover(1.45, 0.05, 2.15)).toBe(0);
    expect(m.cover(2, 0, 0.5)).toBe(1);
    expect(m.cover(2, 0, 2.5)).toBe(1);
    expect(m.cover(1, 0, 1.5)).toBe(1);
    expect(m.cover(3, 0, 1.5)).toBe(1);
  });

  it('the opening is derived and valid', () => {
    const o = m.g.openings.get('o')!;
    expect(o.valid).toBe(true);
    expect(o.bottom).toBeCloseTo(1, 12);
    expect(o.top).toBeCloseTo(2.2, 12);
  });
});

describe('door: from the floor', () => {
  it('0.90 × 2.10 at 0.50 from the start: 2.24 − 0.378 = 1.862 m³, 0.62 m² in plan', () => {
    const m = measure(docWith([W], [newOpening('o', wid('w'), 'door', { kind: 'fromStart', distance: 0.5 })]));
    expect(m.plan).toBeCloseTo(0.62, 12);
    expect(m.volume).toBeCloseTo(1.862, 12);
    expect(m.cover(0.9, 0, 1)).toBe(0);
    expect(m.cover(0.9, 0, 0.01)).toBe(0);
    expect(m.cover(0.9, 0, 2.5)).toBe(1);
  });

  it('a door and a window: both holes, 2.24 − 0.378 − 0.288 = 1.574 m³', () => {
    const m = measure(
      docWith([W], [
        newOpening('a', wid('w'), 'door', { kind: 'fromStart', distance: 0.5 }),
        newOpening('b', wid('w'), 'window', { kind: 'fromEnd', distance: 0.5 }),
      ]),
    );
    expect(m.volume).toBeCloseTo(1.574, 12);
    expect(m.plan).toBeCloseTo(0.8 - 0.18 - 0.24, 12);
    expect(m.cover(0.9, 0, 2.5)).toBe(1);
    expect(m.cover(2.9, 0, 1.5)).toBe(0);
    expect(m.cover(1.8, 0, 1.5)).toBe(1);
  });
});

describe('layers, joins, offsets, invalid', () => {
  it('masonry 15 cm, three layers: every layer is cut, 0.60 − 0.18 = 0.42 m²', () => {
    const m = measure(docWith([{ ...W, wallTypeId: 'wt_masonry15' }], [newOpening('o', wid('w'), 'window', { kind: 'centered' })]));
    expect(m.plan).toBeCloseTo(0.42, 12);
    expect(m.g.solids.get(wid('w'))!.pieces).toHaveLength(6);
    expect(m.volume).toBeCloseTo(0.6 * 2.8 - 1.2 * 0.15 * 1.2, 12);
  });

  it('an L corner keeps its miter: 1.40 − 0.18 = 1.22 m²', () => {
    const m = measure(docWith([W, wall(wid('b'), [0, 0], [0, 3])], [newOpening('o', wid('w'), 'door', { kind: 'fromEnd', distance: 0.5 })]));
    expect(m.plan).toBeCloseTo(1.22, 12);
  });

  it('a base offset raises the window with the wall: 4 × 0.2 × 2.3 − 0.288 = 1.552 m³', () => {
    const m = measure(docWith([{ ...W, baseOffset: 0.5 }], [newOpening('o', wid('w'), 'window', { kind: 'centered' })]));
    expect(m.volume).toBeCloseTo(1.552, 12);
    expect(m.cover(2, 0, 1.4)).toBe(1);
    expect(m.cover(2, 0, 1.6)).toBe(0);
    expect(m.g.openings.get('o')!.bottom).toBeCloseTo(1.5, 12);
  });

  it('too tall: sill 2.00 + 1.20 on 2.80, warned, the hole stops at the top: 2.24 − 0.192 = 2.048 m³', () => {
    const o = { ...newOpening('o', wid('w'), 'window', { kind: 'centered' }), sill: 2 };
    const m = measure(docWith([W], [o]));
    expect(m.volume).toBeCloseTo(2.048, 12);
    expect(m.g.openings.get('o')!.valid).toBe(false);
    expect(m.g.openingWarnings).toEqual([{ kind: 'openingTooTall', openings: ['o'] }]);
  });

  it('past the end: warned, and the wall is not cut at all (a cut there would open its joint)', () => {
    const m = measure(docWith([W], [newOpening('o', wid('w'), 'door', { kind: 'fromStart', distance: 3.5 })]));
    expect(m.plan).toBeCloseTo(0.8, 12);
    expect(m.g.openingWarnings).toEqual([{ kind: 'openingOutside', openings: ['o'] }]);
  });

  it('a wall drawn backwards: from the start still means from its own start', () => {
    const m = measure(docWith([wall(wid('w'), [4, 0], [0, 0])], [newOpening('o', wid('w'), 'door', { kind: 'fromStart', distance: 0.5 })]));
    expect(m.cover(3.1, 0, 1)).toBe(0);
    expect(m.cover(0.9, 0, 1)).toBe(1);
  });
});
