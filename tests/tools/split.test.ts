// Dividing, joining and cornering walls, by hand: a 20 cm wall b from (0, 0) to (4, 0) with a 0.90 m
// door 2.5 m from its start (jambs at 2.5 and 3.4).

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument, wallNumber } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { newOpening } from '../../src/elements/opening/schema';
import { canMerge, cornerWalls, mergeWalls, splitWall } from '../../src/tools/split';
import { wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';
import { oid } from '../ids';

const wall = (id: WallId, a: [number, number], b: [number, number], bulge = 0): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  ...(bulge ? { bulge } : {}),
});
const doc: Doc = { ...newDocument(), walls: [wall(wid('b'), [0, 0], [4, 0])], openings: [newOpening(oid('opening_d'), wid('b'), 'door', { kind: 'fromStart', distance: 2.5 })] };
const area = (d: Doc) =>
  [...deriveGeometry(d).solids.values()].flatMap((s) => s.pieces).reduce((sum, p) => sum + Math.abs(p.polygon.reduce((a, v, i, ps) => a + v.x * ps[(i + 1) % ps.length]!.y - ps[(i + 1) % ps.length]!.x * v.y, 0)) / 2, 0);

describe('dividing a wall', () => {
  const split = splitWall(doc, wid('b'), { x: 1.5, y: 0.03 }, wid('wall_2')) as Doc;

  it('at the foot of the point: (0, 0)–(1.5, 0) keeps the id, (1.5, 0)–(4, 0) is the new wall', () => {
    expect(split.walls.map((w) => [w.id, w.start, w.end])).toEqual([
      ['b', { x: 0, y: 0 }, { x: 1.5, y: 0 }],
      ['wall_2', { x: 1.5, y: 0 }, { x: 4, y: 0 }],
    ]);
  });

  it('the door goes to the part it is on and stays where it was: 1 m from that part’s start', () => {
    expect(split.openings[0]).toMatchObject({ wallId: wid('wall_2'), rule: { kind: 'fromStart', distance: 1 } });
    const o = deriveGeometry(split).openings.get(oid('opening_d'))!;
    expect(o.start).toBeCloseTo(1, 9);
  });

  it('the two parts tile the old body: the same area, no overlap and no gap', () => {
    expect(area(split)).toBeCloseTo(area(doc), 9);
    expect(deriveGeometry(split).warnings).toEqual([]);
  });

  it('the other walls keep their numbers: the new part comes after them, as a new wall does', () => {
    const d: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [4, 0]), wall(wid('c'), [4, 0], [4, 3])] };
    const r = splitWall(d, wid('a'), { x: 2, y: 0 }, wid('wall_2')) as Doc;
    expect(['a', 'c', 'wall_2'].map((id) => wallNumber(r, id))).toEqual([1, 2, 3]);
  });

  it('refused through the door, or too near an end', () => {
    expect(splitWall(doc, wid('b'), { x: 2.8, y: 0 }, wid('wall_2'))).toBe('throughOpening');
    expect(splitWall(doc, wid('b'), { x: 0.005, y: 0 }, wid('wall_2'))).toBe('tooShort');
  });

  it('an arc: a half circle cut at its middle gives two quarter arcs, bulge tan(π/8) each', () => {
    const d: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [4, 0], 1)] };
    const r = splitWall(d, wid('a'), { x: 2, y: -2.05 }, wid('wall_2')) as Doc;
    expect(r.walls[0]!.end.x).toBeCloseTo(2, 9);
    expect(r.walls[0]!.end.y).toBeCloseTo(-2, 9);
    expect(r.walls[0]!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 12);
    expect(r.walls[1]!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 12);
  });
});

describe('joining walls', () => {
  it('the two parts joined again: the wall it was, the door 2.5 m from its start', () => {
    const split = splitWall(doc, wid('b'), { x: 1.5, y: 0 }, wid('wall_2')) as Doc;
    expect(canMerge(split, 'b', 'wall_2')).toBe(true);
    const merged = mergeWalls(split, 'b', 'wall_2')!;
    expect(merged.walls).toEqual([doc.walls[0]]);
    expect(merged.openings[0]).toMatchObject({ wallId: wid('b'), rule: { kind: 'fromStart', distance: 2.5 } });
  });

  it('not when they are not in line, end to end, or of the same type', () => {
    const d: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [2, 0]), wall(wid('c'), [2, 0], [2, 3]), wall(wid('e'), [3, 0], [5, 0])] };
    expect(canMerge(d, 'a', 'c')).toBe(false);
    expect(canMerge(d, 'a', 'e')).toBe(false);
  });
});

describe('cornering', () => {
  it('two walls that do not meet are each taken to where their lines cross, (4, 0)', () => {
    const d: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [3, 0]), wall(wid('c'), [4, 1], [4, 4])] };
    const walls = cornerWalls(d, 'a', 'c')!;
    expect(walls.find((w) => w.id === 'a')!.end).toEqual({ x: 4, y: 0 });
    expect(walls.find((w) => w.id === 'c')!.start).toEqual({ x: 4, y: 0 });
  });

  it('parallel walls have no corner', () => {
    const d: Doc = { ...newDocument(), walls: [wall(wid('a'), [0, 0], [3, 0]), wall(wid('c'), [0, 1], [3, 1])] };
    expect(cornerWalls(d, 'a', 'c')).toBeNull();
  });
});
