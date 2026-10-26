// The fields permanent dimensions show in the panel (ui/fields.ts builds the rows).

import type { Field } from '../../ui/fields';
import { num, t } from '../../ui/i18n';
import type { Dimension } from './schema';

export interface DimensionFieldActions {
  readonly setDimensionDistance: (ids: readonly string[], distance: number) => void;
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
        return values.every((v) => v !== null && Math.abs(v - first!) < 1e-9) ? `${num(first!)} m` : t('dim.varies');
      },
    },
    { id: 'distance', label: 'dim.distance', kind: 'number', min: 0, get: (d) => Math.abs(d.offset), set: (v) => act.setDimensionDistance(ids, v) },
  ];
}
