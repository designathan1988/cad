// Commands on permanent dimensions. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import { deriveGeometry } from '../../project/derive';
import { placeDimension } from './anchor';
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

/** Dimensions made together (automatic dimensioning): one step. */
export const addDimensions = (dims: readonly Dimension[]): Command<Doc> => ({
  label: 'cmd.autoDimension',
  apply: (doc) => (dims.length === 0 ? doc : { ...doc, dimensions: [...doc.dimensions, ...dims] }),
});

/** Locked at the length each measures now, or unlocked; one whose end is gone is left as it is. */
export const lockDimensions = (ids: readonly string[], lock: boolean): Command<Doc> => ({
  label: lock ? 'cmd.lockDimension' : 'cmd.unlockDimension',
  apply: (doc) => {
    const g = lock ? deriveGeometry(doc) : null;
    let changed = false;
    const dimensions = doc.dimensions.map((d) => {
      if (!ids.includes(d.id)) return d;
      if (!lock) {
        if (d.locked === undefined) return d;
        changed = true;
        const { locked: _, ...rest } = d;
        return rest;
      }
      const at = placeDimension(doc, g!, d);
      if (!at || d.locked === at.length) return d;
      changed = true;
      return { ...d, locked: at.length };
    });
    return changed ? { ...doc, dimensions } : doc;
  },
});

/** The chains of these dimensions made equal (EQ) or not: every member of each. */
export const setDimensionsEqual = (ids: readonly string[], equal: boolean): Command<Doc> => ({
  label: equal ? 'cmd.equalDimensions' : 'cmd.unequalDimensions',
  apply: (doc) => {
    const chains = new Set(doc.dimensions.filter((d) => ids.includes(d.id) && d.chain !== undefined).map((d) => d.chain!));
    let changed = false;
    const dimensions = doc.dimensions.map((d) => {
      if (d.chain === undefined || !chains.has(d.chain) || (d.eq === true) === equal) return d;
      changed = true;
      if (equal) return { ...d, eq: true as const };
      const { eq: _, ...rest } = d;
      return rest;
    });
    return changed ? { ...doc, dimensions } : doc;
  },
});
