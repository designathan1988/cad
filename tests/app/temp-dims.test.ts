import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { tempDims } from '../../src/session/temp-dims';
import { vec } from '../../src/model/vector';
import { newOpening } from '../../src/elements/opening/schema';
import { wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';
import { oid } from '../ids';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_concrete20',
  start: vec(a[0], a[1]),
  end: vec(b[0], b[1]),
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const doc = (): Doc => ({
  ...newDocument(),
  walls: [wall(wid('w0'), [0, 0], [6, 0]), wall(wid('w1'), [6, 0], [6, 4])],
  // A 0.90 m door 1.00 m from w0's start: jambs at 1.00 and 1.90, 4.10 m to the end, 4.00 m to the
  // inner face of w1 (20 cm, its face at 5.90), which is what the end side measures to.
  openings: [newOpening(oid('o'), wid('w0'), 'door', { kind: 'fromStart', distance: 1 })],
});

describe('temporary dimensions', () => {
  it('a selected wall shows its length; typing 8 stretches it and drags the corner', () => {
    const d = doc();
    const dims = tempDims(d, deriveGeometry(d), new Set(['w0']));
    expect(dims).toHaveLength(1);
    expect(dims[0]!.value).toBeCloseTo(6, 12);
    const next = dims[0]!.apply(8)!.apply(d);
    expect(next.walls.find((w) => w.id === 'w0')!.end).toEqual(vec(8, 0));
    expect(next.walls.find((w) => w.id === 'w1')!.start).toEqual(vec(8, 0));
  });

  it('a selected opening shows its distances to the wall meeting its own on each side: its face, or the end when none', () => {
    const d = doc();
    const dims = tempDims(d, deriveGeometry(d), new Set(['o']));
    // No wall at w0's start: from the end. At its end, w1: from its inner face.
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([1, 4]);
    expect(dims[1]!.b.x).toBeCloseTo(5.9, 12);
  });

  it('a partition between the opening and the end: measured to its face, not across it to the far corner', () => {
    const d0 = doc();
    // A 20 cm partition at x = 3.5 standing on w0: its faces at 3.40 and 3.60.
    const d: Doc = { ...d0, walls: [...d0.walls, wall(wid('p'), [3.5, 0], [3.5, 3])] };
    const dims = tempDims(d, deriveGeometry(d), new Set(['o']));
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([1, 1.5]);
    // Typing 0.60 there: the door's end jamb 0.60 from the partition's face, kept as a rule from the end.
    const next = dims[1]!.apply(0.6)!.apply(d);
    const rule = next.openings[0]!.rule;
    expect(rule.kind).toBe('fromEnd');
    expect(rule.kind === 'fromEnd' && rule.distance).toBeCloseTo(6 - 3.4 + 0.6, 12);
  });

  it('typing a distance sets the rule from that end, keeping the opening where the user said', () => {
    const d = doc();
    const [fromStart, fromEnd] = tempDims(d, deriveGeometry(d), new Set(['o']));
    expect(fromStart!.apply(2)!.apply(d).openings[0]!.rule).toEqual({ kind: 'fromStart', distance: 2 });
    // From w1's inner face (0.10 m in from w0's end): 0.50 from it is 0.60 from the end.
    const r = fromEnd!.apply(0.5)!.apply(d).openings[0]!.rule;
    expect(r.kind === 'fromEnd' && r.distance).toBeCloseTo(0.6, 12);
  });

  it('a length of zero is refused; several selected show nothing', () => {
    const d = doc();
    expect(tempDims(d, deriveGeometry(d), new Set(['w0']))[0]!.apply(0)).toBeNull();
    expect(tempDims(d, deriveGeometry(d), new Set(['w0', 'w1']))).toEqual([]);
  });

  // A 0.90 m window w measured 0.50 m from the door's end jamb (1.90): it runs from 2.40 to 3.30.
  const fromDoor = (toward: 'start' | 'end'): Doc => {
    const d = doc();
    return { ...d, openings: [...d.openings, { ...newOpening(oid('w'), wid('w0'), 'window', { kind: 'fromOpening', openingId: oid('o'), distance: 0.5, toward }), width: 0.9 }] };
  };

  it('measured from another opening: the dimension on that side is the gap to it, and typing keeps the rule', () => {
    const d = fromDoor('end');
    const dims = tempDims(d, deriveGeometry(d), new Set(['w']));
    // The gap to the door (1.90 to 2.40), then w1's inner face (3.30 to 5.90).
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([0.5, 2.6]);
    expect(dims[0]!.a).toEqual(vec(1.9, 0));
    const next = dims[0]!.apply(0.8)!.apply(d);
    expect(next.openings.find((o) => o.id === 'w')!.rule).toEqual({ kind: 'fromOpening', openingId: oid('o'), distance: 0.8, toward: 'end' });
  });

  it('measured toward an opening after it: the gap is on its end side', () => {
    const d0 = doc();
    // The door at 4.00 to 4.90; the window 0.50 before it: 2.60 to 3.50.
    const d: Doc = {
      ...d0,
      openings: [
        newOpening(oid('o'), wid('w0'), 'door', { kind: 'fromStart', distance: 4 }),
        { ...newOpening(oid('w'), wid('w0'), 'window', { kind: 'fromOpening', openingId: oid('o'), distance: 0.5, toward: 'start' }), width: 0.9 },
      ],
    };
    const dims = tempDims(d, deriveGeometry(d), new Set(['w']));
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([2.6, 0.5]);
    expect(dims[1]!.b).toEqual(vec(4, 0));
  });

  // An arc: a half circle from (0, 0) to (2, 0) through (1, -1): chord 2, radius 1, centre (1, 0).
  const arcDoc = (): Doc => ({ ...newDocument(), walls: [{ ...wall(wid('a'), [0, 0], [2, 0]), bulge: 1 }] });

  it('a selected arc shows its chord and its radius', () => {
    const d = arcDoc();
    const dims = tempDims(d, deriveGeometry(d), new Set(['a']));
    expect(dims.map((x) => x.id)).toEqual(['a:chord', 'a:radius']);
    expect(dims[0]!.value).toBeCloseTo(2, 12);
    expect(dims[1]!.value).toBeCloseTo(1, 12);
    // The radius runs from the centre along the radius at 30 % of the sweep, not the middle one, so its
    // value stays clear of the chord's (the tester's K03): angle π + 0.3π, (1 + cos 1.3π, sin 1.3π).
    expect(dims[1]!.a.x).toBeCloseTo(1, 12);
    expect(dims[1]!.a.y).toBeCloseTo(0, 12);
    expect(dims[1]!.b.x).toBeCloseTo(1 + Math.cos(1.3 * Math.PI), 12);
    expect(dims[1]!.b.y).toBeCloseTo(Math.sin(1.3 * Math.PI), 12);
  });

  it('typing a chord moves the end along it and keeps the sweep; typing a radius keeps the ends', () => {
    const d = arcDoc();
    const [chord, radius] = tempDims(d, deriveGeometry(d), new Set(['a']));
    const longer = chord!.apply(3)!.apply(d).walls[0]!;
    expect(longer.end).toEqual(vec(3, 0));
    expect(longer.bulge).toBe(1);
    const flatter = radius!.apply(2)!.apply(d).walls[0]!;
    expect(flatter.start).toEqual(vec(0, 0));
    expect(flatter.end).toEqual(vec(2, 0));
    expect(flatter.bulge).toBeCloseTo(Math.tan(Math.PI / 12), 12);
    // Shorter than half the chord: no arc has it.
    expect(radius!.apply(0.9)).toBeNull();
  });

  it("a wall's length goes on the side where no wall stands on it: a T on its left sends it right", () => {
    const d0 = doc();
    // w0 runs +x, its left is +y; a partition standing on it at x = 3 rises into +y.
    const d: Doc = { ...d0, walls: [...d0.walls, wall(wid('p'), [3, 0], [3, 3])] };
    const [len] = tempDims(d, deriveGeometry(d), new Set(['w0']));
    expect(len!.side.y).toBeCloseTo(-1, 12);
    // Without it, the left as before.
    const [plain] = tempDims(d0, deriveGeometry(d0), new Set(['w0']));
    expect(plain!.side.y).toBeCloseTo(1, 12);
  });

  it('a wall facing a parallel one: the clear gap between their faces, and typing it moves the wall, its corner following', () => {
    const d0 = doc();
    // w0 along y = 0 and a parallel 20 cm wall along y = 3 over x 1..5: faces 0.10 and 2.90, a 2.80 gap.
    const d: Doc = { ...d0, walls: [...d0.walls, wall(wid('p'), [1, 3], [5, 3])] };
    const dims = tempDims(d, deriveGeometry(d), new Set(['w0']));
    const gap = dims.find((x) => x.id === 'w0:gapAbove')!;
    expect(gap.value).toBeCloseTo(2.8, 12);
    // Drawn across the gap at the middle of the overlap (x = 3).
    expect(gap.a.x).toBeCloseTo(3, 12);
    expect([gap.a.y, gap.b.y].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([0.1, 2.9]);
    expect(dims.some((x) => x.id === 'w0:gapBelow')).toBe(false);
    // 2.50: w0 moves 0.30 toward p; w1, meeting it at (6, 0), follows.
    const next = gap.apply(2.5)!.apply(d);
    expect(next.walls.find((w) => w.id === 'w0')!.start.y).toBeCloseTo(0.3, 12);
    expect(next.walls.find((w) => w.id === 'w1')!.start.y).toBeCloseTo(0.3, 12);
  });

  it('a parallel wall whose run does not overlap, or one on another level, gives no gap', () => {
    const d0 = doc();
    const d: Doc = { ...d0, walls: [...d0.walls, wall(wid('p'), [7, 3], [9, 3]), { ...wall(wid('q'), [0, 2], [6, 2]), levelId: 'lvl_other' }] };
    expect(tempDims(d, deriveGeometry(d), new Set(['w0'])).map((x) => x.id)).toEqual(['w0:length']);
  });
});
