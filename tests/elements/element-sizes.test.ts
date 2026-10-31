// A building element never gets a height, width, length or thickness of nothing, however it is set: a
// wall's top under its bottom, an end dragged onto the other, a door of no width, a scaled-down column,
// a file with a negative sill or a layer of no thickness.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallHeights } from '../../src/project/doc';
import { createStore } from '../../src/core/store';
import { MIN_ELEMENT_SIZE } from '../../src/model/tolerance';
import { vec } from '../../src/model/vector';
import { KINDS } from '../../src/elements/registry';
import { addOpening, updateOpening } from '../../src/elements/opening/commands';
import { newOpening } from '../../src/elements/opening/schema';
import { addWalls } from '../../src/elements/wall/commands';
import { isOpening, isWall } from '../../src/project/file-guards';
import { stretchEnd } from '../../src/elements/wall/edit';
import { lid, oid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, x1: number, top: DocWall['top'] = { kind: 'level', offset: 0 }, baseOffset = 0): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: { x: 0, y: 0 },
  end: { x: x1, y: 0 },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  baseOffset,
  top,
});

describe('walls', () => {
  it('a top at its level offset down past the bottom keeps the least height', () => {
    const doc = { ...newDocument(), walls: [wall(wid('w'), 4, { kind: 'level', offset: -10 })] };
    const h = wallHeights(doc, doc.walls[0]!);
    expect(h.top - h.bottom).toBeCloseTo(MIN_ELEMENT_SIZE, 9);
  });
  it('a base raised over its level top keeps the least height', () => {
    const doc = { ...newDocument(), walls: [wall(wid('w'), 4, { kind: 'level', offset: 0 }, 9)] };
    const h = wallHeights(doc, doc.walls[0]!);
    expect(h.top - h.bottom).toBeCloseTo(MIN_ELEMENT_SIZE, 9);
  });
  it('a fixed height of nothing is the least', () => {
    const doc = { ...newDocument(), walls: [wall(wid('w'), 4, { kind: 'fixed', height: 0 })] };
    const h = wallHeights(doc, doc.walls[0]!);
    expect(h.top - h.bottom).toBeCloseTo(MIN_ELEMENT_SIZE, 9);
  });
  it('an end dragged onto the other end is refused', () => {
    const doc = { ...newDocument(), walls: [wall(wid('w'), 4)] };
    expect(stretchEnd(doc, wid('w'), 'end', vec(0, 0))[0]!.end).toEqual({ x: 4, y: 0 });
  });
  it('a file wall of no length is not taken', () => {
    expect(isWall(wall(wid('w'), 0))).toBe(false);
    expect(isWall(wall(wid('w'), 4))).toBe(true);
  });
});

describe('doors and windows', () => {
  const setup = () => {
    const s = createStore<Doc>(newDocument());
    s.dispatch(addWalls([wall(wid('w'), 5)]));
    s.dispatch(addOpening(newOpening(oid('d'), wid('w'), 'door', { kind: 'centered' })));
    return s;
  };
  it('a width or height of nothing, or a sill under the floor, is refused', () => {
    const s = setup();
    const before = s.get().openings[0]!;
    for (const patch of [{ width: 0 }, { width: -1 }, { height: 0 }, { sill: -0.1 }, { width: Number.NaN }]) {
      s.dispatch(updateOpening(oid('d'), patch));
      expect(s.get().openings[0]).toEqual(before);
    }
    s.dispatch(updateOpening(oid('d'), { width: 1.2 }));
    expect(s.get().openings[0]!.width).toBe(1.2);
  });
  it('a file opening with a negative sill is not taken', () => {
    expect(isOpening({ ...newOpening(oid('d'), wid('w'), 'window', { kind: 'centered' }), sill: -0.5 })).toBe(false);
  });
});

describe('scaled down', () => {
  const factor = { map: (p: { x: number; y: number }) => ({ x: p.x * 1e-4, y: p.y * 1e-4 }), factor: 1e-4, mirror: false };
  const kind = (name: string) => KINDS.find((k) => k.key === name)!;
  it('a column, a beam and a stair keep the least their panels take', () => {
    const column = kind('columns').mapped!({ id: 'c', levelId: lid('lvl_ground'), at: { x: 1, y: 1 }, angle: 0, width: 0.3, depth: 0.3 } as never, factor as never, 'c2') as { width: number; depth: number };
    expect(column.width).toBe(0.05);
    expect(column.depth).toBe(0.05);
    const beam = kind('beams').mapped!({ id: 'b', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, width: 0.2 } as never, factor as never, 'b2') as { width: number };
    expect(beam.width).toBe(0.05);
    const stair = kind('stairs').mapped!({ id: 's', at: { x: 0, y: 0 }, angle: 0, width: 1.2, turn: 'left' } as never, factor as never, 's2') as { width: number };
    expect(stair.width).toBe(0.4);
  });
});

describe('floors from a file', () => {
  const floor = (extra: object) => ({ id: 'f', levelId: lid('lvl_ground'), thickness: 0.15, offset: 0, source: { kind: 'outline', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }] }, ...extra });
  const valid = (f: unknown) => KINDS.find((k) => k.key === 'floors')!.valid(f);
  it('a layer of no thickness or a tile of no size is not taken', () => {
    expect(valid(floor({}))).toBe(true);
    expect(valid(floor({ layers: [{ materialId: 'concrete', thickness: 0 }] }))).toBe(false);
    expect(valid(floor({ tiling: { width: 0, length: 0.6, joint: 0.003, pattern: 'grid', angle: 0 } }))).toBe(false);
    expect(valid(floor({ tiling: { width: 0.6, length: 0.6, joint: 0.003, pattern: 'grid', angle: 0 } }))).toBe(true);
  });
});
