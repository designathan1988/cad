// Commands on the measures. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import type { ArcFace, ArcMeasure, Measure } from './schema';

export const addMeasure = (m: Measure): Command<Doc> => ({
  label: 'cmd.addMeasure',
  apply: (doc) => ({ ...doc, measures: [...doc.measures, m] }),
});

/** What some arc walls' measures say and at which line; an angle's arc radius. Others are left as they are. */
export const updateMeasures = (ids: readonly string[], patch: { readonly type?: ArcMeasure; readonly face?: ArcFace; readonly radius?: number }): Command<Doc> => ({
  label: 'cmd.updateMeasure',
  apply: (doc) => {
    const set = new Set(ids);
    let changed = false;
    const measures = doc.measures.map((m): Measure => {
      if (!set.has(m.id)) return m;
      const next: Measure =
        m.type === 'angle'
          ? patch.radius !== undefined && patch.radius > 0
            ? { ...m, radius: patch.radius }
            : m
          : m.type === 'coord'
            ? m
            : { ...m, ...(patch.type ? { type: patch.type } : {}), ...(patch.face ? { face: patch.face } : {}) };
      if (next !== m && JSON.stringify(next) !== JSON.stringify(m)) changed = true;
      return JSON.stringify(next) === JSON.stringify(m) ? m : next;
    });
    return changed ? { ...doc, measures } : doc;
  },
});
