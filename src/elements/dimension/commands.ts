// Commands on permanent dimensions. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { Dimension } from './schema';

export const addDimension = (dim: Dimension): Command<Doc> => ({
  label: 'cmd.addDimension',
  apply: (doc) => ({ ...doc, dimensions: [...doc.dimensions, dim] }),
});

/** A dimension's line set off by `offset` (m, to the left of a → b; negative, its right): dragged. */
export const setDimensionOffset = (id: string, offset: number): Command<Doc> => ({
  label: 'cmd.updateDimension',
  apply: (doc) =>
    !Number.isFinite(offset) || !doc.dimensions.some((d) => d.id === id && d.offset !== offset)
      ? doc
      : { ...doc, dimensions: doc.dimensions.map((d) => (d.id === id ? { ...d, offset } : d)) },
});

/** How far the dimensions' lines stand off what they measure (m), each on the side it is on. */
export const setDimensionDistance = (ids: readonly string[], distance: number): Command<Doc> => ({
  label: 'cmd.updateDimension',
  apply: (doc) => {
    if (!Number.isFinite(distance) || distance < 0) return doc;
    let changed = false;
    const dimensions = doc.dimensions.map((d) => {
      if (!ids.includes(d.id)) return d;
      const offset = (d.offset < 0 ? -1 : 1) * distance;
      if (offset === d.offset) return d;
      changed = true;
      return { ...d, offset };
    });
    return changed ? { ...doc, dimensions } : doc;
  },
});
