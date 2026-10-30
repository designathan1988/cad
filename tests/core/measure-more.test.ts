// Phase 9's typed measures: "@dx;dy" from the point being drawn from, and the project's variables by
// name in any measure; their names, and kept in the project file.

import { afterEach, describe, expect, it } from 'vitest';
import { isVariableName, parseLength, parseNumber, parsePointFrom, setBareUnit, setVariables } from '../../src/core/measure';
import { newDocument } from '../../src/project/doc';
import { readProject, writeProject } from '../../src/io/project-file';
import { setProjectVariables } from '../../src/ui/variables-dialog';

afterEach(() => {
  setVariables({});
  setBareUnit(1);
});

describe('relative points', () => {
  it('"@dx;dy" is from the point drawn from; "x;y" is where it says', () => {
    expect(parsePointFrom('@1,5;-2', { x: 10, y: 10 })).toEqual({ ok: true, value: { x: 11.5, y: 8 } });
    expect(parsePointFrom('1,5;-2', { x: 10, y: 10 })).toEqual({ ok: true, value: { x: 1.5, y: -2 } });
    expect(parsePointFrom(' @ 50cm;0 ', { x: 1, y: 1 })).toEqual({ ok: true, value: { x: 1.5, y: 1 } });
  });

  it('without a point to go from, "@" is no point', () => {
    expect(parsePointFrom('@1;2', null)).toEqual({ ok: false });
    expect(parsePointFrom('@1', { x: 0, y: 0 })).toEqual({ ok: false });
  });
});

describe('project variables', () => {
  it('a name is typed for its length, in expressions too', () => {
    setVariables({ pd: 2.8, modulo: 0.6 });
    expect(parseLength('pd')).toEqual({ ok: true, value: 2.8 });
    expect(parseLength('pd - 0,10')).toEqual({ ok: true, value: expect.closeTo(2.7, 12) });
    expect(parseLength('3 x modulo')).toEqual({ ok: true, value: expect.closeTo(1.8, 12) });
    expect(parseNumber('modulo*10')).toEqual({ ok: true, value: expect.closeTo(6, 12) });
    // "=" before a name (typed while drawing, so its letters are not shortcuts) changes nothing.
    expect(parseLength('=pd-0,10')).toEqual({ ok: true, value: expect.closeTo(2.7, 12) });
    expect(parsePointFrom('=pd;0', null)).toEqual({ ok: true, value: { x: 2.8, y: 0 } });
    // An unknown name is no measure.
    expect(parseLength('altura').ok).toBe(false);
  });

  it('a variable is in metres whatever the unit typed numbers are in', () => {
    setVariables({ pd: 2.8 });
    setBareUnit(0.01);
    expect(parseLength('pd + 10')).toEqual({ ok: true, value: expect.closeTo(2.9, 12) });
  });

  it("names: a letter first, letters, digits or _; not a unit's", () => {
    expect(isVariableName('pd')).toBe(true);
    expect(isVariableName('pé_direito2')).toBe(true);
    expect(isVariableName('2pd')).toBe(false);
    expect(isVariableName('cm')).toBe(false);
    expect(isVariableName('x')).toBe(false);
    expect(isVariableName('a b')).toBe(false);
  });

  it('kept in the file; the command refuses a bad name and takes them all off', () => {
    const doc = setProjectVariables({ pd: 2.8 }).apply(newDocument());
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.variables).toEqual({ pd: 2.8 });
    expect(setProjectVariables({ 'cm': 1 }).apply(doc)).toBe(doc);
    expect('variables' in setProjectVariables({}).apply(doc)).toBe(false);
    const bad = readProject(JSON.stringify({ ...newDocument(), variables: { pd: 2.8, '9x': 1, mm: 2, h: 'tall' } }));
    expect(bad.ok && bad.doc.variables).toEqual({ pd: 2.8 });
  });
});
