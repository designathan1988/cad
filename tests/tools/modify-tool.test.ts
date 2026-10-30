// The Modify tools' clicks and typed values, by hand: what each step keeps and what it applies.

import { describe, expect, it } from 'vitest';
import { vec } from '../../src/model/vector';
import { MODIFY_START, modifyTransition, previewTransform } from '../../src/session/modify-tool';

const at = (x: number, y: number) => vec(x, y);
const click = (x: number, y: number) => ({ kind: 'click' as const, point: at(x, y) });

describe('move and copy', () => {
  it('base, then where it goes: the translation between them', () => {
    const s1 = modifyTransition('move', MODIFY_START, click(1, 1), null);
    expect(s1.state).toEqual({ step: 'second', base: at(1, 1) });
    const s2 = modifyTransition('move', s1.state, click(4, 5), at(4, 5));
    expect(s2.apply!.map(at(0, 0))).toEqual(at(3, 4));
    expect(s2.state).toEqual(MODIFY_START);
  });

  it('a typed distance goes toward the pointer: 2 m along (3, 4)/5', () => {
    const r = modifyTransition('copy', { step: 'second', base: at(0, 0) }, { kind: 'typed', value: 2 }, at(3, 4));
    const p = r.apply!.map(at(0, 0));
    expect(p.x).toBeCloseTo(1.2, 12);
    expect(p.y).toBeCloseTo(1.6, 12);
  });

  it('a value before the base is refused; Esc steps back, and at the start leaves', () => {
    expect(modifyTransition('move', MODIFY_START, { kind: 'typed', value: 2 }, null).rejected).toBe(true);
    expect(modifyTransition('move', { step: 'second', base: at(0, 0) }, { kind: 'escape' }, null).state).toEqual(MODIFY_START);
    expect(modifyTransition('move', MODIFY_START, { kind: 'escape' }, null).leave).toBe(true);
  });
});

describe('rotate', () => {
  it('centre, start of the angle, end of it: from (2, 0) to (0, 2) about the origin is a quarter turn', () => {
    const s = modifyTransition('rotate', { step: 'second', base: at(0, 0) }, click(2, 0), at(2, 0));
    expect(s.state).toEqual({ step: 'third', base: at(0, 0), ref: at(2, 0) });
    const p = previewTransform('rotate', s.state, at(0, 2))!.map(at(1, 0));
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(1, 12);
  });

  it('typed degrees after the centre: 90 turns (1, 0) to (0, 1)', () => {
    const r = modifyTransition('rotate', { step: 'second', base: at(0, 0) }, { kind: 'typed', value: 90 }, null);
    const p = r.apply!.map(at(1, 0));
    expect(p.x).toBeCloseTo(0, 12);
    expect(p.y).toBeCloseTo(1, 12);
  });
});

describe('scale', () => {
  it('a 2 m reference stretched to 3 m along it: × 1.5, wherever the pointer strays across it', () => {
    const state = { step: 'third' as const, base: at(0, 0), ref: at(2, 0) };
    expect(previewTransform('scale', state, at(3, 0.4))!.factor).toBeCloseTo(1.5, 12);
    // Behind the base: no scale.
    expect(previewTransform('scale', state, at(-1, 0))).toBeNull();
  });

  it('a typed factor after the base', () => {
    const r = modifyTransition('scale', { step: 'second', base: at(1, 1) }, { kind: 'typed', value: 2 }, null);
    expect(r.apply!.map(at(2, 1))).toEqual(at(3, 1));
  });
});

describe('mirror', () => {
  it('two points of the axis; a typed angle gives the axis through the first point', () => {
    const r = modifyTransition('mirror', { step: 'second', base: at(0, 0) }, click(0, 1), at(0, 1));
    expect(r.apply!.map(at(2, 3))).toEqual(at(-2, 3));
    const typed = modifyTransition('mirror', { step: 'second', base: at(0, 0) }, { kind: 'typed', value: 0 }, null);
    const p = typed.apply!.map(at(2, 3));
    expect(p.x).toBeCloseTo(2, 12);
    expect(p.y).toBeCloseTo(-3, 12);
  });
});

describe('offset', () => {
  // A wall along the line (0, 0) → (4, 3): its unit normal (−0.6, 0.8) points to its left.
  const line = { start: at(0, 0), end: at(4, 3) };

  it('one click, no base: as far off the line as the pointer, square to it', () => {
    // (−0.6, 0.8) · (1, 2) = 1: the pointer at (1, 2) is 1 m to the left.
    const r = modifyTransition('offset', MODIFY_START, click(1, 2), null, line);
    const p = r.apply!.map(at(0, 0));
    expect(p.x).toBeCloseTo(-0.6, 12);
    expect(p.y).toBeCloseTo(0.8, 12);
    expect(r.state).toEqual(MODIFY_START);
  });

  it('a typed distance goes to the side the pointer is on', () => {
    const right = modifyTransition('offset', MODIFY_START, { kind: 'typed', value: 2 }, at(3, 0), line).apply!.map(at(0, 0));
    expect(right.x).toBeCloseTo(1.2, 12);
    expect(right.y).toBeCloseTo(-1.6, 12);
    const left = modifyTransition('offset', MODIFY_START, { kind: 'typed', value: 2 }, at(0, 3), line).apply!.map(at(0, 0));
    expect(left.x).toBeCloseTo(-1.2, 12);
    expect(left.y).toBeCloseTo(1.6, 12);
  });

  it('on the line itself, or with no wall, nothing; Esc leaves', () => {
    expect(modifyTransition('offset', MODIFY_START, click(2, 1.5), null, line).rejected).toBe(true);
    expect(modifyTransition('offset', MODIFY_START, click(1, 2), null).rejected).toBe(true);
    expect(modifyTransition('offset', MODIFY_START, { kind: 'escape' }, null, line).leave).toBe(true);
  });
});
