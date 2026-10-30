// Phase 9's units: feet and inches shown and typed, areas in ft² in such a project, angles' decimals,
// slopes in percent, degrees or 1:n; all kept in the project file.

import { afterEach, describe, expect, it } from 'vitest';
import { parseLength } from '../../src/core/measure';
import { newDocument } from '../../src/project/doc';
import { readProject, writeProject } from '../../src/io/project-file';
import { setLang } from '../../src/ui/i18n';
import { angleNum, areaText, DEFAULT_UNITS, feetInches, isUnits, lengthText, setUnits, slopeShown, slopeTyped, slopeUnit } from '../../src/ui/units';

afterEach(() => {
  setUnits(DEFAULT_UNITS);
  setLang('en');
});

describe('feet and inches', () => {
  it("shows 12' 6\", carrying 12 inches into a foot, to the inches' decimals", () => {
    setLang('en');
    expect(feetInches(3.81, 0)).toBe(`12' 6"`);
    expect(feetInches(0.3048 * 3 - 0.0001, 0)).toBe(`3' 0"`);
    expect(feetInches(0.0254 * 5.25, 2)).toBe(`0' 5.25"`);
    expect(feetInches(-0.3048, 0)).toBe(`-1' 0"`);
  });

  it("a project in feet writes its lengths so, and its areas in ft²", () => {
    setLang('en');
    setUnits({ length: 'ft', decimals: 0 });
    expect(lengthText(3.81)).toBe(`12' 6"`);
    expect(areaText(1)).toBe('10.76 ft²');
    setUnits(DEFAULT_UNITS);
    expect(areaText(1)).toBe('1.00 m²');
  });

  it("reads 12'6\", 12' 6, 3ft, 8in and 12ft 6in in any project; a bare number in feet in a project in feet", () => {
    expect(parseLength(`12'6"`)).toEqual({ ok: true, value: expect.closeTo(3.81, 9) });
    expect(parseLength(`12' 6`)).toEqual({ ok: true, value: expect.closeTo(3.81, 9) });
    expect(parseLength('12ft 6in')).toEqual({ ok: true, value: expect.closeTo(3.81, 9) });
    expect(parseLength('3ft')).toEqual({ ok: true, value: expect.closeTo(0.9144, 9) });
    expect(parseLength('8in')).toEqual({ ok: true, value: expect.closeTo(0.2032, 9) });
    expect(parseLength(`2' + 450mm`)).toEqual({ ok: true, value: expect.closeTo(0.6096 + 0.45, 9) });
    setUnits({ length: 'ft', decimals: 0 });
    expect(parseLength('10')).toEqual({ ok: true, value: expect.closeTo(3.048, 9) });
  });
});

describe('angles and slopes', () => {
  it("angles to the project's decimals (1 when not set)", () => {
    setLang('en');
    expect(angleNum(33.6901)).toBe('33.7');
    setUnits({ ...DEFAULT_UNITS, angleDecimals: 3 });
    expect(angleNum(33.6901)).toBe('33.690');
  });

  it('a slope in percent, degrees or 1:n, and back', () => {
    expect(slopeShown(30)).toBe(30);
    expect(slopeUnit()).toBe('%');
    setUnits({ ...DEFAULT_UNITS, slope: 'degrees' });
    expect(slopeUnit()).toBe('°');
    expect(slopeShown(100)).toBeCloseTo(45, 9);
    expect(slopeTyped(45)).toBeCloseTo(100, 9);
    setUnits({ ...DEFAULT_UNITS, slope: 'ratio' });
    expect(slopeUnit()).toBe('1:');
    expect(slopeShown(8.33)).toBeCloseTo(12.0048, 3);
    expect(slopeTyped(12)).toBeCloseTo(8.3333, 3);
    expect(slopeShown(0)).toBe(0);
    expect(slopeTyped(0)).toBe(0);
  });
});

describe('the units in the file', () => {
  it('feet, angles and slopes are kept; out of range are refused', () => {
    const units = { length: 'ft' as const, decimals: 1, angleDecimals: 2, slope: 'ratio' as const };
    const r = readProject(writeProject({ ...newDocument(), units }));
    expect(r.ok && r.doc.units).toEqual(units);
    expect(isUnits({ length: 'ft', decimals: 0 })).toBe(true);
    expect(isUnits({ length: 'ft', decimals: 0, angleDecimals: 9 })).toBe(false);
    expect(isUnits({ length: 'ft', decimals: 0, slope: 'grade' })).toBe(false);
  });
});
