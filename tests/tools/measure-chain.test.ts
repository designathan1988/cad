// Measuring a chain (phase 9): stretches added up, the angle between the last two, the area and the
// perimeter once closed on the first point; Enter ends it open; Esc drops it.

import { describe, expect, it } from 'vitest';
import { angleAt, chainArea, chainLength, MEASURE_IDLE, type MeasureState, measureTransition } from '../../src/elements/measure/tool';

const p = (x: number, y: number) => ({ x, y });
const click = (s: MeasureState, x: number, y: number) => measureTransition(s, { kind: 'click', point: p(x, y) }, 'chain');

describe('measuring a chain', () => {
  it('each click adds a stretch; the same point twice adds nothing', () => {
    let s = click(MEASURE_IDLE, 0, 0);
    expect(s).toEqual({ kind: 'chain', points: [p(0, 0)] });
    s = click(s, 4, 0);
    s = click(s, 4, 0);
    s = click(s, 4, 3);
    expect(s).toEqual({ kind: 'chain', points: [p(0, 0), p(4, 0), p(4, 3)] });
    expect(chainLength((s as { readonly points: readonly { x: number; y: number }[] }).points, false)).toBeCloseTo(7, 12);
  });

  it('clicked on its first point with three corners or more, it closes: area and perimeter', () => {
    let s = click(MEASURE_IDLE, 0, 0);
    s = click(s, 4, 0);
    s = click(s, 4, 3);
    s = click(s, 0, 0);
    expect(s).toEqual({ kind: 'chainDone', points: [p(0, 0), p(4, 0), p(4, 3)], closed: true });
    const pts = (s as { readonly points: readonly { x: number; y: number }[] }).points;
    expect(chainArea(pts)).toBeCloseTo(6, 12);
    expect(chainLength(pts, true)).toBeCloseTo(12, 12);
    // Two corners only: back on the first is a stretch, not an area.
    const two = click(click(click(MEASURE_IDLE, 0, 0), 4, 0), 0, 0);
    expect(two.kind).toBe('chain');
  });

  it('Enter ends it open with two points or more; with one it waits; Esc drops it', () => {
    const one = click(MEASURE_IDLE, 0, 0);
    expect(measureTransition(one, { kind: 'enter' }, 'chain')).toBe(one);
    const two = click(one, 3, 4);
    expect(measureTransition(two, { kind: 'enter' }, 'chain')).toEqual({ kind: 'chainDone', points: [p(0, 0), p(3, 4)], closed: false });
    expect(measureTransition(two, { kind: 'escape' }, 'chain')).toBe(MEASURE_IDLE);
    // Done, a click starts the next chain.
    expect(click(measureTransition(two, { kind: 'enter' }, 'chain'), 9, 9)).toEqual({ kind: 'chain', points: [p(9, 9)] });
  });

  it('the area is the same whichever way round, and an L is not a rectangle', () => {
    const l = [p(0, 0), p(4, 0), p(4, 1), p(1, 1), p(1, 3), p(0, 3)];
    expect(chainArea(l)).toBeCloseTo(4 + 2, 12);
    expect(chainArea([...l].reverse())).toBeCloseTo(6, 12);
  });

  it('the angle where two stretches meet, 0 to 180°', () => {
    expect(angleAt(p(1, 0), p(0, 0), p(0, 1))).toBeCloseTo(90, 9);
    expect(angleAt(p(1, 0), p(0, 0), p(-1, 0))).toBeCloseTo(180, 9);
    expect(angleAt(p(1, 0), p(0, 0), p(1, 1))).toBeCloseTo(45, 9);
    expect(angleAt(p(0, 0), p(0, 0), p(1, 1))).toBeNull();
  });

  it('two points stay as they were: a third click starts again', () => {
    const done = measureTransition(measureTransition(MEASURE_IDLE, { kind: 'click', point: p(0, 0) }), { kind: 'click', point: p(1, 0) });
    expect(done.kind).toBe('done');
    expect(measureTransition(done, { kind: 'enter' })).toBe(done);
  });
});
