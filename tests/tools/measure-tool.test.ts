// The measure tool's table, row by row, and what a tape reads.

import { describe, expect, it } from 'vitest';
import { MEASURE_IDLE, measureTransition, reading } from '../../src/tools/measure-tool';

const p = (x: number, y: number) => ({ x, y });

describe('measure tool', () => {
  it('idle, click: the tape starts there', () => {
    expect(measureTransition(MEASURE_IDLE, { kind: 'click', point: p(1, 2) })).toEqual({ kind: 'from', a: p(1, 2) });
  });

  it('from a, click: the measurement a–b stays', () => {
    expect(measureTransition({ kind: 'from', a: p(1, 2) }, { kind: 'click', point: p(4, 6) })).toEqual({ kind: 'done', a: p(1, 2), b: p(4, 6) });
  });

  it('done, click: a new tape from there', () => {
    expect(measureTransition({ kind: 'done', a: p(1, 2), b: p(4, 6) }, { kind: 'click', point: p(0, 0) })).toEqual({ kind: 'from', a: p(0, 0) });
  });

  it('Esc drops the tape or clears the measurement', () => {
    expect(measureTransition({ kind: 'from', a: p(1, 2) }, { kind: 'escape' })).toEqual(MEASURE_IDLE);
    expect(measureTransition({ kind: 'done', a: p(1, 2), b: p(4, 6) }, { kind: 'escape' })).toEqual(MEASURE_IDLE);
  });

  it('a 3-4-5 tape reads 5 m, 3 along x, 4 along y, at 53.13°; backwards, the angle turns half round', () => {
    const r = reading(p(1, 2), p(4, 6));
    expect(r.length).toBeCloseTo(5, 12);
    expect([r.dx, r.dy]).toEqual([3, 4]);
    expect(r.angle).toBeCloseTo(53.130102354, 6);
    expect(reading(p(4, 6), p(1, 2)).angle).toBeCloseTo(233.130102354, 6);
  });
});
