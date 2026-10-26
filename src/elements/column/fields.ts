// The fields columns show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import type { ColumnPatch } from './commands';
import type { Column } from './schema';

export interface ColumnFieldActions {
  readonly updateColumns: (ids: readonly string[], patch: ColumnPatch) => void;
}

const DEG = 180 / Math.PI;

export function columnFields(columns: readonly Column[], act: ColumnFieldActions): Field<Column>[] {
  const ids = columns.map((c) => c.id);
  return [
    { id: 'width', label: 'column.width', kind: 'number', min: 0.05, get: (c) => c.width, set: (v) => act.updateColumns(ids, { width: v }) },
    { id: 'depth', label: 'column.depth', icon: 'width', kind: 'number', min: 0.05, get: (c) => c.depth, set: (v) => act.updateColumns(ids, { depth: v }) },
    // In degrees, as the Rotate tool takes them.
    { id: 'angle', label: 'column.angle', icon: 'rotate', kind: 'number', unit: '°', get: (c) => Math.round(c.angle * DEG * 100) / 100, set: (v) => act.updateColumns(ids, { angle: v / DEG }) },
    { id: 'topOffset', label: 'column.topOffset', kind: 'number', get: (c) => c.topOffset ?? 0, set: (v) => act.updateColumns(ids, { topOffset: v }) },
  ];
}
