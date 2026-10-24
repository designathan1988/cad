// The wall tool's table, row by row, and the 8 × 6 rectangle typed in.

import { describe, expect, it } from 'vitest';
import { vec } from '../../src/core/vector';
import { snap } from '../../src/tools/snap';
import { IDLE, wallTransition, type WallToolEvent, type WallToolState } from '../../src/tools/wall-tool';

function run(events: WallToolEvent[]) {
  let state: WallToolState = IDLE;
  const segments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
  for (const e of events) {
    const r = wallTransition(state, e);
    state = r.state;
    if (r.segment) segments.push(r.segment);
  }
  return { state, segments };
}

describe('wall tool table', () => {
  it('idle + click starts a chain; no wall yet', () => {
    const r = run([{ kind: 'click', point: vec(0, 0) }]);
    expect(r.state.kind).toBe('drawing');
    expect(r.segments).toHaveLength(0);
  });

  it('drawing + click makes a wall from the last point', () => {
    const r = run([{ kind: 'click', point: vec(0, 0) }, { kind: 'click', point: vec(3, 0) }]);
    expect(r.segments).toEqual([{ start: vec(0, 0), end: vec(3, 0) }]);
  });

  it('a click on the last point is rejected, not a zero wall', () => {
    expect(wallTransition({ kind: 'drawing', start: vec(0, 0), last: vec(1, 0), cursor: vec(1, 0), count: 1 }, { kind: 'click', point: vec(1, 0) }).rejected).toBe(true);
  });

  it('typed length follows the cursor direction; typed angle wins', () => {
    const r = run([
      { kind: 'click', point: vec(0, 0) },
      { kind: 'move', point: vec(0, 5) },
      { kind: 'typed', length: 2, angle: null },
      { kind: 'typed', length: 1, angle: 0 },
    ]);
    expect(r.segments[0]!.end.x).toBeCloseTo(0, 12);
    expect(r.segments[0]!.end.y).toBeCloseTo(2, 12);
    expect(r.segments[1]!.end.x).toBeCloseTo(1, 12);
    expect(r.segments[1]!.end.y).toBeCloseTo(2, 12);
  });

  it('enter ends the chain and keeps the walls; escape drops only the segment in progress', () => {
    const r = run([{ kind: 'click', point: vec(0, 0) }, { kind: 'click', point: vec(2, 0) }, { kind: 'enter' }]);
    expect(r.state).toEqual(IDLE);
    expect(r.segments).toHaveLength(1);
    const e = run([{ kind: 'click', point: vec(0, 0) }, { kind: 'click', point: vec(2, 0) }, { kind: 'escape' }]);
    expect(e.segments).toHaveLength(1);
  });

  it('8 × 6 typed: four walls, the last closes on the start and ends the chain', () => {
    const r = run([
      { kind: 'click', point: vec(0, 0) },
      { kind: 'typed', length: 8, angle: 0 },
      { kind: 'typed', length: 6, angle: 90 },
      { kind: 'typed', length: 8, angle: 180 },
      { kind: 'move', point: vec(0, 0) },
      { kind: 'click', point: vec(0, 0) },
    ]);
    expect(r.segments).toHaveLength(4);
    expect(r.segments[3]!.end).toEqual(vec(0, 0));
    expect(r.state).toEqual(IDLE);
  });
});

describe('snaps', () => {
  const segments = [{ start: vec(0, 0), end: vec(4, 0) }];
  const base = { mpp: 0.01, segments, from: null, chainStart: null, enabled: true, orthogonal: false };

  it('an end within 10 px wins', () => {
    expect(snap({ ...base, cursor: vec(4.05, 0.03) })).toMatchObject({ kind: 'endpoint', point: vec(4, 0) });
  });
  it('the midpoint', () => {
    expect(snap({ ...base, cursor: vec(2.04, 0.02) })).toMatchObject({ kind: 'midpoint', point: vec(2, 0) });
  });
  it('the chain start closes', () => {
    const r = snap({ ...base, segments: [], cursor: vec(0.03, 0.02), from: vec(3, 3), chainStart: vec(0, 0) });
    expect(r).toMatchObject({ kind: 'start', point: vec(0, 0) });
  });
  it('15° steps with a 5 cm length', () => {
    const r = snap({ ...base, segments: [], cursor: vec(3.02, 0.08), from: vec(0, 0) });
    expect(r.kind).toBe('angle');
    expect(r.point.x).toBeCloseTo(3, 12);
    expect(r.point.y).toBeCloseTo(0, 12);
  });
  it('off: the cursor as it is', () => {
    expect(snap({ ...base, enabled: false, cursor: vec(4.05, 0.03) })).toEqual({ kind: 'none', point: vec(4.05, 0.03) });
  });
  it('Shift: right angles only', () => {
    const r = snap({ ...base, segments: [], cursor: vec(0.3, 2.01), from: vec(0, 0), orthogonal: true });
    expect(r.point.x).toBe(0);
    expect(r.point.y).toBeCloseTo(2, 12);
  });
});
