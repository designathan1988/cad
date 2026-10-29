// The fields columns show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import type { ColumnPatch } from './commands';
import { type Column, COLUMN_PLATE, COLUMN_SHAPES, type ColumnShape } from './schema';
import type { Doc } from '../../app/document';
import { name, t } from '../../ui/i18n';

export interface ColumnFieldActions {
  readonly updateColumns: (ids: readonly string[], patch: ColumnPatch) => void;
}

const DEG = 180 / Math.PI;

export function columnFields(columns: readonly Column[], act: ColumnFieldActions, doc: Doc): Field<Column>[] {
  const ids = columns.map((c) => c.id);
  const profile = (cs: readonly Column[]) => cs.every((c) => c.shape === 'I' || c.shape === 'H' || c.shape === 'L');
  // Up to its own level's top, or another level's floor: the levels above every selected one's own. From
  // the first one's alone, a column on the floor above was sent up to its own floor or below.
  const owns = columns.map((c) => doc.levels.find((l) => l.id === c.levelId)?.elevation ?? Infinity);
  const highest = owns.length > 0 ? Math.max(...owns) : Infinity;
  const above = doc.levels.filter((l) => l.elevation > highest).sort((a, b) => a.elevation - b.elevation);
  return [
    {
      id: 'shape',
      label: 'column.shape',
      kind: 'select',
      icon: 'column',
      options: COLUMN_SHAPES.map((s) => ({ value: s, label: t(`column.shape.${s}`) })),
      get: (c) => c.shape ?? 'rect',
      set: (v) => act.updateColumns(ids, { shape: v as ColumnShape }),
    },
    { id: 'width', label: 'column.width', kind: 'number', min: 0.05, get: (c) => c.width, set: (v) => act.updateColumns(ids, { width: v }) },
    { id: 'depth', label: 'column.depth', icon: 'width', kind: 'number', min: 0.05, get: (c) => c.depth, set: (v) => act.updateColumns(ids, { depth: v }) },
    // In degrees, as the Rotate tool takes them.
    { id: 'angle', label: 'column.angle', icon: 'rotate', kind: 'number', unit: '°', get: (c) => Math.round(c.angle * DEG * 100) / 100, set: (v) => act.updateColumns(ids, { angle: v / DEG }) },
    { id: 'plate', label: 'column.plate', kind: 'number', sub: true, min: 0.002, decimals: 3, when: profile, get: (c) => c.plate ?? COLUMN_PLATE, set: (v) => act.updateColumns(ids, { plate: v }) },
    {
      id: 'topLevel',
      label: 'column.topLevel',
      kind: 'select',
      icon: 'arrowUp',
      when: () => above.length > 0,
      options: [{ value: '', label: t('column.topOwn') }, ...above.map((l) => ({ value: l.id, label: name(l.name) }))],
      get: (c) => c.topLevelId ?? '',
      set: (v) => act.updateColumns(ids, { topLevelId: v === '' ? null : v }),
    },
    { id: 'topOffset', label: 'column.topOffset', kind: 'number', get: (c) => c.topOffset ?? 0, set: (v) => act.updateColumns(ids, { topOffset: v }) },
  ];
}
