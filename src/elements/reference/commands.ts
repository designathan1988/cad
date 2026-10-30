// Commands on references. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../../project/doc';
import type { Command } from '../../core/store';
import { isReference, type Reference } from './schema';

export const addReference = (r: Reference): Command<Doc> => ({
  label: 'cmd.addReference',
  apply: (doc) => (!isReference(r) ? doc : { ...doc, references: [...doc.references, r] }),
});

/** Its opacity, turn, scale or place; what would not be a reference changes nothing. */
export const updateReferences = (ids: readonly string[], patch: Partial<Pick<Reference, 'opacity' | 'angle' | 'scale' | 'at'>>, label = 'cmd.updateReference'): Command<Doc> => ({
  label,
  apply: (doc) => {
    let changed = false;
    const references = doc.references.map((r) => {
      if (!ids.includes(r.id)) return r;
      const next = { ...r, ...patch };
      if (!isReference(next) || JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, references } : doc;
  },
});

/** One reference as it is now (calibrated). */
export const setReference = (r: Reference, label = 'cmd.calibrateReference'): Command<Doc> => ({
  label,
  apply: (doc) => (!isReference(r) || !doc.references.some((x) => x.id === r.id) ? doc : { ...doc, references: doc.references.map((x) => (x.id === r.id ? r : x)) }),
});
