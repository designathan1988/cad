// Locked and equal dimensions, and automatic dimensioning (phase 10), on a box worked out by hand: 4 × 3 m
// between the axes of 15 cm walls (w1 south, w2 east, w3 north, w4 west), joined at the corners.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { placeDimension } from '../../src/elements/dimension/anchor';
import { autoDimensions, CHAIN_OFF, TOTAL_OFF } from '../../src/elements/dimension/auto';
import { lockDimensions, setDimensionsEqual } from '../../src/elements/dimension/commands';
import { equalChains, settleDimensions } from '../../src/elements/dimension/constraints';
import type { Dimension } from '../../src/elements/dimension/schema';
import { newOpening } from '../../src/elements/opening/schema';
import { moveWalls } from '../../src/elements/wall/edit';
import { lid, oid, rid, tid, wid, xid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: tid('wt_masonry15'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
});

const box: Doc = {
  ...newDocument(),
  walls: [wall(wid('w1'), [0, 0], [4, 0]), wall(wid('w2'), [4, 0], [4, 3]), wall(wid('w3'), [4, 3], [0, 3]), wall(wid('w4'), [0, 3], [0, 0])],
};

/** West wall's axis to east wall's axis, at y = 1.5: 4 m. */
const across: Dimension = {
  id: xid('dim_x'),
  levelId: lid('lvl_ground'),
  a: { kind: 'wall', wallId: wid('w4'), end: 'start', along: 1.5, offset: 0 },
  b: { kind: 'wall', wallId: wid('w2'), end: 'start', along: 1.5, offset: 0 },
  offset: 0.5,
};

const lengthOf = (doc: Doc, id: string) => placeDimension(doc, deriveGeometry(doc), doc.dimensions.find((d) => d.id === id)!)!.length;
const moved = (doc: Doc, id: WallId, x: number): Doc => ({ ...doc, walls: moveWalls(doc, [id], { x, y: 0 }) });

describe('locked dimensions', () => {
  it('locking keeps the length it measures now; unlocking forgets it', () => {
    const doc = lockDimensions(['dim_x'], true).apply({ ...box, dimensions: [across] });
    expect(doc.dimensions[0]!.locked).toBeCloseTo(4, 9);
    expect(lockDimensions(['dim_x'], true).apply(doc)).toBe(doc);
    expect(lockDimensions(['dim_x'], false).apply(doc).dimensions[0]!.locked).toBeUndefined();
  });

  it('an unlocked dimension lets the wall go: nothing else moves', () => {
    const before = { ...box, dimensions: [across] };
    const r = settleDimensions(before, moved(before, wid('w2'), 1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(lengthOf(r.doc, 'dim_x')).toBeCloseTo(5, 9);
  });

  it('the east wall moved 1 m: the west wall goes along, the length stays 4 m', () => {
    const before = { ...box, dimensions: [{ ...across, locked: 4 }] };
    const r = settleDimensions(before, moved(before, wid('w2'), 1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(lengthOf(r.doc, 'dim_x')).toBeCloseTo(4, 6);
    const w4 = r.doc.walls.find((w) => w.id === 'w4')!;
    expect(w4.start.x).toBeCloseTo(1, 6);
    expect(w4.end.x).toBeCloseTo(1, 6);
  });

  it('the west wall moved instead: the east one follows it', () => {
    const before = { ...box, dimensions: [{ ...across, locked: 4 }] };
    const r = settleDimensions(before, moved(before, wid('w4'), -0.5));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(lengthOf(r.doc, 'dim_x')).toBeCloseTo(4, 6);
    expect(r.doc.walls.find((w) => w.id === 'w2')!.start.x).toBeCloseTo(3.5, 6);
  });

  it("a wall's own length locked: moving its neighbour stretches it back from its other end", () => {
    const len: Dimension = { id: xid('dim_l'), levelId: lid('lvl_ground'), a: { kind: 'wall', wallId: wid('w1'), end: 'start', along: 0, offset: 0 }, b: { kind: 'wall', wallId: wid('w1'), end: 'end', along: 0, offset: 0 }, offset: -0.5, locked: 4 };
    const before = { ...box, dimensions: [len] };
    const r = settleDimensions(before, moved(before, wid('w2'), 1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w1 = r.doc.walls.find((w) => w.id === 'w1')!;
    expect(Math.hypot(w1.end.x - w1.start.x, w1.end.y - w1.start.y)).toBeCloseTo(4, 6);
  });

  it('a window held by a lock slides along its wall with the wall it is measured from', () => {
    const win = newOpening(oid('opening_w'), wid('w1'), 'window', { kind: 'fromStart', distance: 1 }, { width: 1, height: 1, sill: 1 });
    // From the window's far jamb (x = 2) to the south-east corner of the axes (4, 0): 2 m, locked.
    const d: Dimension = { id: xid('dim_w'), levelId: lid('lvl_ground'), a: { kind: 'opening', openingId: oid('opening_w'), jamb: 'end', offset: 0 }, b: { kind: 'wall', wallId: wid('w2'), end: 'start', along: 0, offset: 0 }, offset: -0.6, locked: 2 };
    const before = { ...box, openings: [win], dimensions: [d] };
    expect(lengthOf(before, 'dim_w')).toBeCloseTo(2, 6);
    const r = settleDimensions(before, moved(before, wid('w2'), 0.5));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(lengthOf(r.doc, 'dim_w')).toBeCloseTo(2, 6);
    const rule = r.doc.openings[0]!.rule;
    expect(rule.kind === 'fromStart' && rule.distance).toBeCloseTo(1.5, 6);
  });

  it('a lock that cannot be kept is said, and nothing done', () => {
    // A window on the south wall held 1 m from a point to its north: the window cannot go north.
    const win = newOpening(oid('opening_w'), wid('w1'), 'window', { kind: 'fromStart', distance: 1 }, { width: 1, height: 1, sill: 1 });
    const d: Dimension = { id: xid('dim_n'), levelId: lid('lvl_ground'), a: { kind: 'opening', openingId: oid('opening_w'), jamb: 'start', offset: 0 }, b: { kind: 'wall', wallId: wid('w3'), end: 'end', along: 1, offset: 0 }, offset: 0.4, locked: 3 };
    const before = { ...box, openings: [win], dimensions: [d] };
    const r = settleDimensions(before, moved(before, wid('w3'), 0));
    expect(r.ok).toBe(true);
    const north = { ...before, walls: before.walls.map((w) => (w.id === 'w3' ? { ...w, start: { x: 4, y: 3.5 }, end: { x: 0, y: 3.5 } } : w)) };
    const r2 = settleDimensions(before, north);
    // The north wall moved: the window (its other end) would have to go north, square to its wall.
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.dim.id).toBe('dim_n');
  });
});

describe('equal chains', () => {
  // A partition at x = 1 between the west and east walls; a chain west → partition → east.
  const withPartition: Doc = { ...box, walls: [...box.walls, wall(wid('w5'), [1, 0], [1, 3])] };
  const chain: Dimension[] = [
    { id: xid('dim_1'), levelId: lid('lvl_ground'), a: { kind: 'wall', wallId: wid('w4'), end: 'start', along: 1.5, offset: 0 }, b: { kind: 'wall', wallId: wid('w5'), end: 'start', along: 1.5, offset: 0 }, offset: 0.5, chain: 'chain_a' },
    { id: xid('dim_2'), levelId: lid('lvl_ground'), a: { kind: 'wall', wallId: wid('w5'), end: 'start', along: 1.5, offset: 0 }, b: { kind: 'wall', wallId: wid('w2'), end: 'start', along: 1.5, offset: 0 }, offset: 0.5, chain: 'chain_a' },
  ];

  it('EQ set on one member marks its whole chain, and moves the partition to the middle', () => {
    const before = { ...withPartition, dimensions: chain };
    const after = setDimensionsEqual(['dim_1'], true).apply(before);
    expect(after.dimensions.every((d) => d.eq)).toBe(true);
    expect(equalChains(after.dimensions)).toHaveLength(1);
    const r = settleDimensions(before, after);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.walls.find((w) => w.id === 'w5')!.start.x).toBeCloseTo(2, 6);
    expect(lengthOf(r.doc, 'dim_1')).toBeCloseTo(2, 6);
    expect(lengthOf(r.doc, 'dim_2')).toBeCloseTo(2, 6);
  });

  it('the east wall moved: the partition keeps to the middle', () => {
    const before = { ...withPartition, walls: withPartition.walls.map((w) => (w.id === 'w5' ? wall(wid('w5'), [2, 0], [2, 3]) : w)), dimensions: chain.map((d) => ({ ...d, eq: true as const })) };
    const r = settleDimensions(before, moved(before, wid('w2'), 2));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.doc.walls.find((w) => w.id === 'w5')!.start.x).toBeCloseTo(3, 6);
  });

  it('EQ taken off the chain', () => {
    const doc = { ...withPartition, dimensions: chain.map((d) => ({ ...d, eq: true as const })) };
    expect(setDimensionsEqual(['dim_2'], false).apply(doc).dimensions.some((d) => d.eq)).toBe(false);
  });
});

describe('automatic dimensioning', () => {
  const win = newOpening(oid('opening_w'), wid('w1'), 'window', { kind: 'fromStart', distance: 1 }, { width: 1.2, height: 1, sill: 1 });
  const room = { id: rid('room_a'), levelId: lid('lvl_ground'), seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1' };
  const doc: Doc = { ...box, openings: [win], rooms: [room] };
  const ids = (() => {
    let n = 0;
    return (p: string) => `${p}_${++n}`;
  })();

  it('along the south wall: a chain corner → jambs → corner on its outer face, and the whole length past it', () => {
    const g = deriveGeometry(doc);
    const dims = autoDimensions(doc, g, lid('lvl_ground'), ['w1'], ids);
    const chain = dims.filter((d) => d.chain);
    const total = dims.filter((d) => !d.chain);
    expect(chain).toHaveLength(3);
    expect(total).toHaveLength(1);
    const lengths = chain.map((d) => placeDimension(doc, g, d)!.length);
    // The outer face runs 4.15 m (the corners reach 7.5 cm past each axis end); the window's jambs at 1 and 2.2.
    expect(lengths[0]).toBeCloseTo(1.075, 6);
    expect(lengths[1]).toBeCloseTo(1.2, 6);
    expect(lengths[2]).toBeCloseTo(1.875, 6);
    expect(placeDimension(doc, g, total[0]!)!.length).toBeCloseTo(4.15, 6);
    // On the outside: the south face, to the right of west → east.
    expect(chain.every((d) => d.offset === -CHAIN_OFF)).toBe(true);
    expect(total[0]!.offset).toBe(-TOTAL_OFF);
    expect(placeDimension(doc, g, chain[0]!)!.a.y).toBeCloseTo(-0.075, 6);
  });

  it('with no wall named, every wall with a face outside: four, each its own whole length', () => {
    const g = deriveGeometry(doc);
    const dims = autoDimensions(doc, g, lid('lvl_ground'), null, ids);
    // South: a chain of three and its total; the others a single dimension each.
    expect(dims).toHaveLength(7);
  });

  it('a wall already dimensioned on that side: the new chain stands past it', () => {
    const g = deriveGeometry(doc);
    const old: Dimension = { id: xid('dim_old'), levelId: lid('lvl_ground'), a: { kind: 'wall', wallId: wid('w1'), end: 'start', along: 0, offset: 0 }, b: { kind: 'wall', wallId: wid('w1'), end: 'end', along: 0, offset: 0 }, offset: -0.7 };
    const dims = autoDimensions({ ...doc, dimensions: [old] }, g, lid('lvl_ground'), ['w1'], ids);
    expect(dims.filter((d) => d.chain).every((d) => d.offset === -(0.7 + CHAIN_OFF))).toBe(true);
    expect(dims.find((d) => !d.chain)!.offset).toBeCloseTo(-(0.7 + TOTAL_OFF), 9);
  });

  it('the chain follows the window when it moves', () => {
    const g = deriveGeometry(doc);
    const dims = autoDimensions(doc, g, lid('lvl_ground'), ['w1'], ids);
    const moved = { ...doc, openings: [{ ...win, rule: { kind: 'fromStart' as const, distance: 2 } }], dimensions: dims };
    const g2 = deriveGeometry(moved);
    const first = moved.dimensions.find((d) => d.chain)!;
    expect(placeDimension(moved, g2, first)!.length).toBeCloseTo(2.075, 6);
  });
});
