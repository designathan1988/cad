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
});
