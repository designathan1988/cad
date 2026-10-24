import { describe, expect, it } from 'vitest';
import { parseLength, parseLengthAngle, parsePoint } from '../../src/core/measure';

const len = (s: string) => {
  const r = parseLength(s);
  return r.ok ? r.value : null;
};

describe('typed lengths', () => {
  it.each([
    ['4', 4],
    ['4,5', 4.5],
    ['4.5', 4.5],
    ['450cm', 4.5],
    ['450 cm', 4.5],
    ['4500mm', 4.5],
    ['3m', 3],
    ['1,5+0,3', 1.8],
    ['2 - 0,5', 1.5],
    ['2*1,5', 3],
    ['3/2', 1.5],
    ['(1+2)*2', 6],
    ['1m+50cm', 1.5],
    [',5', 0.5],
  ])('%s → %d m', (text, metres) => {
    expect(len(text)).toBeCloseTo(metres, 12);
  });

  it.each(['', 'abc', '4,5,6', '1+', '(1+2', '4 km', '1;alert(1)', 'Infinity'])('rejects %j', (text) => {
    expect(parseLength(text).ok).toBe(false);
  });
});

describe('length and angle', () => {
  it('reads "4,5<90" as 4.5 m at 90°', () => {
    expect(parseLengthAngle('4,5<90')).toEqual({ ok: true, value: { length: 4.5, angle: 90 } });
  });
  it('reads a length alone with no angle', () => {
    expect(parseLengthAngle('3')).toEqual({ ok: true, value: { length: 3, angle: null } });
  });
  it('rejects two angles and a unit on the angle', () => {
    expect(parseLengthAngle('3<90<45').ok).toBe(false);
    expect(parseLengthAngle('3<90cm').ok).toBe(false);
  });
});

describe('typed points', () => {
  const pt = (s: string) => {
    const r = parsePoint(s);
    return r.ok ? r.value : null;
  };

  it('x;y in metres, with units and expressions, decimal comma or point', () => {
    expect(pt('2;3')).toEqual({ x: 2, y: 3 });
    expect(pt('2,5; 3')).toEqual({ x: 2.5, y: 3 });
    expect(pt('250cm;-1.5')).toEqual({ x: 2.5, y: -1.5 });
    expect(pt('1+1;0')).toEqual({ x: 2, y: 0 });
  });

  it('anything else is not a point', () => {
    for (const s of ['2', '2;', ';3', '2;3;4', 'a;b', '2<90']) expect(pt(s), s).toBeNull();
  });
});
