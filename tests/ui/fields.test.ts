// Panels are built from each element's fields (ref/chat.txt:247): which fields show for the
// selection, and the value each shows, common to all or "varies".

import { describe, expect, it } from 'vitest';
import { fieldStates, type Field } from '../../src/ui/fields';

interface Box {
  kind: 'a' | 'b';
  width: number;
  name: string;
}

const fields: Field<Box>[] = [
  { id: 'width', label: 'panel.width', kind: 'number', get: (x) => x.width, set: () => {} },
  { id: 'name', label: 'room.name', kind: 'text', get: (x) => x.name, set: () => {}, when: (xs) => xs.length === 1 },
  { id: 'onlyB', label: 'panel.sill', kind: 'number', get: (x) => x.width, set: () => {}, when: (xs) => xs.every((x) => x.kind === 'b') },
  { id: 'total', label: 'room.area', kind: 'readout', text: (xs) => String(xs.reduce((s, x) => s + x.width, 0)) },
];

describe('fields of a selection', () => {
  it('one element: every field that applies, with its value', () => {
    const s = fieldStates(fields, [{ kind: 'a', width: 2, name: 'x' }]);
    expect(s.map((f) => [f.field.id, f.value])).toEqual([
      ['width', 2],
      ['name', 'x'],
      ['total', '2'],
    ]);
  });

  it('several: a common value shows, a differing one is null (shown as "varies"); fields for one only are left out', () => {
    const s = fieldStates(fields, [
      { kind: 'b', width: 2, name: 'x' },
      { kind: 'b', width: 3, name: 'y' },
    ]);
    expect(s.map((f) => [f.field.id, f.value])).toEqual([
      ['width', null],
      ['onlyB', null],
      ['total', '5'],
    ]);
  });

  it('no element: nothing', () => {
    expect(fieldStates(fields, [])).toEqual([]);
  });
});
