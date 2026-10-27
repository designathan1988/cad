// The fields permanent dimensions show in the panel (ui/fields.ts builds the rows).

import { lengthText } from '../../ui/units';
import type { Field } from '../../ui/fields';
import { t } from '../../ui/i18n';
import type { Dimension } from './schema';

export interface DimensionFieldActions {
  readonly setDimensionDistance: (ids: readonly string[], distance: number) => void;
  readonly lock: (ids: readonly string[], on: boolean) => void;
  readonly equal: (ids: readonly string[], on: boolean) => void;
}

/** `length`: what a dimension measures now, or null when one of its ends is gone. */
export function dimensionFields(dims: readonly Dimension[], length: (d: Dimension) => number | null, act: DimensionFieldActions): Field<Dimension>[] {
  const ids = dims.map((d) => d.id);
  return [
    {
      id: 'length',
      label: 'dim.length',
      kind: 'readout',
      text: (items) => {
        const values = items.map(length);
        const first = values[0];
        if (values.some((v) => v === null)) return t('dim.lost');
        return values.every((v) => v !== null && Math.abs(v - first!) < 1e-9) ? `${lengthText(first!)}` : t('dim.varies');
      },
    },
    { id: 'distance', label: 'dim.distance', kind: 'number', min: 0, get: (d) => Math.abs(d.offset), set: (v) => act.setDimensionDistance(ids, v) },
    // Locked: its length kept as the model changes (constraints.ts).
    {
      id: 'lock',
      label: dims.every((d) => d.locked !== undefined) ? 'dim.unlock' : 'dim.lock',
      kind: 'action',
      run: () => act.lock(ids, !dims.every((d) => d.locked !== undefined)),
      enabled: (items) => items.every((d) => length(d) !== null),
    },
    // Equal: a chain's members kept alike.
    {
      id: 'equal',
      label: dims.every((d) => d.eq) ? 'dim.unequal' : 'dim.equal',
      kind: 'action',
      when: (items) => items.some((d) => d.chain !== undefined),
      run: () => act.equal(ids, !dims.every((d) => d.eq)),
    },
    {
      id: 'held',
      label: 'dim.constraint',
      kind: 'note',
      when: (items) => items.some((d) => d.locked !== undefined || d.eq),
      text: (items) => (items.some((d) => d.eq) ? t('dim.eqNote') : t('dim.lockNote')),
    },
  ];
}
