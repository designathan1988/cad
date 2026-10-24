import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { tempDims } from '../../src/app/temp-dims';
import { vec } from '../../src/core/vector';
import { newOpening } from '../../src/elements/opening/schema';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
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
  walls: [wall('w0', [0, 0], [6, 0]), wall('w1', [6, 0], [6, 4])],
  // A 0.90 m door 1.00 m from w0's start: jambs at 1.00 and 1.90, 4.10 m to the end.
  openings: [newOpening('o', 'w0', 'door', { kind: 'fromStart', distance: 1 })],
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

  it('a selected opening shows its distances to both ends of its wall', () => {
    const d = doc();
    const dims = tempDims(d, deriveGeometry(d), new Set(['o']));
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([1, 4.1]);
  });

  it('typing a distance sets the rule from that end, keeping the opening where the user said', () => {
    const d = doc();
    const [fromStart, fromEnd] = tempDims(d, deriveGeometry(d), new Set(['o']));
    expect(fromStart!.apply(2)!.apply(d).openings[0]!.rule).toEqual({ kind: 'fromStart', distance: 2 });
    expect(fromEnd!.apply(0.5)!.apply(d).openings[0]!.rule).toEqual({ kind: 'fromEnd', distance: 0.5 });
  });

  it('a length of zero is refused; several selected show nothing', () => {
    const d = doc();
    expect(tempDims(d, deriveGeometry(d), new Set(['w0']))[0]!.apply(0)).toBeNull();
    expect(tempDims(d, deriveGeometry(d), new Set(['w0', 'w1']))).toEqual([]);
  });

  // A 0.90 m window w measured 0.50 m from the door's end jamb (1.90): it runs from 2.40 to 3.30.
  const fromDoor = (toward: 'start' | 'end'): Doc => {
    const d = doc();
    return { ...d, openings: [...d.openings, { ...newOpening('w', 'w0', 'window', { kind: 'fromOpening', openingId: 'o', distance: 0.5, toward }), width: 0.9 }] };
  };

  it('measured from another opening: the dimension on that side is the gap to it, and typing keeps the rule', () => {
    const d = fromDoor('end');
    const dims = tempDims(d, deriveGeometry(d), new Set(['w']));
    // The gap to the door (1.90 to 2.40), then the far end (3.30 to 6).
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([0.5, 2.7]);
    expect(dims[0]!.a).toEqual(vec(1.9, 0));
    const next = dims[0]!.apply(0.8)!.apply(d);
    expect(next.openings.find((o) => o.id === 'w')!.rule).toEqual({ kind: 'fromOpening', openingId: 'o', distance: 0.8, toward: 'end' });
  });

  it('measured toward an opening after it: the gap is on its end side', () => {
    const d0 = doc();
    // The door at 4.00 to 4.90; the window 0.50 before it: 2.60 to 3.50.
    const d: Doc = {
      ...d0,
      openings: [
        newOpening('o', 'w0', 'door', { kind: 'fromStart', distance: 4 }),
        { ...newOpening('w', 'w0', 'window', { kind: 'fromOpening', openingId: 'o', distance: 0.5, toward: 'start' }), width: 0.9 },
      ],
    };
    const dims = tempDims(d, deriveGeometry(d), new Set(['w']));
    expect(dims.map((x) => Math.round(x.value * 1e9) / 1e9)).toEqual([2.6, 0.5]);
    expect(dims[1]!.b).toEqual(vec(4, 0));
  });

  // An arc: a half circle from (0, 0) to (2, 0) through (1, -1): chord 2, radius 1, centre (1, 0).
  const arcDoc = (): Doc => ({ ...newDocument(), walls: [{ ...wall('a', [0, 0], [2, 0]), bulge: 1 }] });

  it('a selected arc shows its chord and its radius', () => {
    const d = arcDoc();
    const dims = tempDims(d, deriveGeometry(d), new Set(['a']));
    expect(dims.map((x) => x.id)).toEqual(['a:chord', 'a:radius']);
    expect(dims[0]!.value).toBeCloseTo(2, 12);
    expect(dims[1]!.value).toBeCloseTo(1, 12);
    // The radius runs from the centre to the middle of the arc.
    expect(dims[1]!.a.x).toBeCloseTo(1, 12);
    expect(dims[1]!.a.y).toBeCloseTo(0, 12);
    expect(dims[1]!.b.y).toBeCloseTo(-1, 12);
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
});
