// The fields grid axes show in the panel (ui/fields.ts builds the rows).

import { lengthText } from '../../ui/units';
import { distance } from '../../core/vector';
import type { Field } from '../../ui/fields';
import type { Grid } from './schema';

export interface GridFieldActions {
  readonly renameGrid: (id: string, name: string) => void;
}

export function gridFields(grids: readonly Grid[], act: GridFieldActions): Field<Grid>[] {
  const one = grids.length === 1 ? grids[0]! : null;
  return [
    // A name each: several axes are not renamed at once.
    ...(one ? [{ id: 'name', label: 'grid.name', kind: 'text', get: (g: Grid) => g.name, set: (v: string) => act.renameGrid(one.id, v) } as const] : []),
    {
      id: 'length',
      label: 'grid.length',
      kind: 'readout',
      text: (items) => {
        const l = items.map((g) => distance(g.start, g.end));
        return l.every((x) => Math.abs(x - l[0]!) < 1e-9) ? `${lengthText(l[0]!)}` : '—';
      },
    },
  ];
}
